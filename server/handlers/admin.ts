import { esRol } from '../../src/utils/validacionUsuario';
import { enTransaccion, pool } from '../db';
import { cerrarSesionesDe, COLUMNAS_USUARIO, usuarioDeFila } from '../usuarios';
import type { Peticion, Respuesta } from './tipos';

/** Zona horaria para agrupar los registros por día. */
export const ZONA_HORARIA = 'America/La_Paz';
const POR_PAGINA = 20;
const MAX_POR_PAGINA = 100;

const NO_ENCONTRADO: Respuesta = { status: 404, body: { error: 'Usuario no encontrado' } };

/** Entero positivo de un texto (parámetro de ruta o de la URL), o undefined. */
function entero(texto: string | undefined): number | undefined {
  if (texto === undefined || !/^\d{1,9}$/.test(texto)) return undefined;
  const n = Number(texto);
  return n >= 1 ? n : undefined;
}

/**
 * GET /api/admin/usuarios?buscar=&pagina=1&por_pagina=20 — búsqueda por nombre o CI (sin
 * distinguir mayúsculas), del registro más nuevo al más antiguo.
 */
export async function listarUsuarios({ query = {} }: Peticion): Promise<Respuesta> {
  const pagina = query.pagina === undefined ? 1 : entero(query.pagina);
  const porPagina = query.por_pagina === undefined ? POR_PAGINA : entero(query.por_pagina);
  if (pagina === undefined || porPagina === undefined || porPagina > MAX_POR_PAGINA) {
    return { status: 400, body: { error: `pagina y por_pagina deben ser enteros positivos (por_pagina hasta ${MAX_POR_PAGINA})` } };
  }
  const buscar = (query.buscar ?? '').trim().slice(0, 100);
  // % y _ se buscan como texto, no como comodines de LIKE
  const patron = `%${buscar.replace(/[\\%_]/g, '\\$&')}%`;
  const filtro = `WHERE $1 = '' OR nombre_completo ILIKE $2 OR ci ILIKE $2`;

  const { rows: conteo } = await pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM usuarios ${filtro}`, [buscar, patron]);
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_USUARIO} FROM usuarios ${filtro} ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`,
    [buscar, patron, porPagina, (pagina - 1) * porPagina]
  );
  return { status: 200, body: { usuarios: rows.map(usuarioDeFila), total: conteo[0].total, pagina, por_pagina: porPagina } };
}

/**
 * PATCH /api/admin/usuarios/:id — { activo?: boolean, rol?: 'usuario' | 'admin' }.
 * Un administrador no puede desactivarse ni quitarse el rol a sí mismo (así siempre queda
 * al menos un administrador). Desactivar una cuenta cierra sus sesiones abiertas.
 */
export async function actualizarUsuario({ params, body, usuario }: Peticion): Promise<Respuesta> {
  const id = entero(params?.id);
  if (id === undefined) return NO_ENCONTRADO;
  const cambios = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const errores: Record<string, string> = {};
  if (cambios.activo !== undefined && typeof cambios.activo !== 'boolean') errores.activo = 'Debe ser true o false';
  if (cambios.rol !== undefined && !esRol(cambios.rol)) errores.rol = "Debe ser 'usuario' o 'admin'";
  if (cambios.activo === undefined && cambios.rol === undefined) errores.cuerpo = 'Indique activo o rol';
  if (Object.keys(errores).length > 0) return { status: 400, body: { errores } };

  if (id === usuario?.id) {
    if (cambios.activo === false) return { status: 400, body: { error: 'No puede desactivar su propia cuenta' } };
    if (cambios.rol === 'usuario') return { status: 400, body: { error: 'No puede quitarse su propio rol de administrador' } };
  }

  const fila = await enTransaccion(async (cliente) => {
    const { rows } = await cliente.query(
      `UPDATE usuarios SET activo = COALESCE($2, activo), rol = COALESCE($3, rol) WHERE id = $1 RETURNING ${COLUMNAS_USUARIO}`,
      [id, cambios.activo ?? null, cambios.rol ?? null]
    );
    if (rows[0] && !rows[0].activo) await cerrarSesionesDe(id, cliente);
    return rows[0];
  });
  return fila ? { status: 200, body: usuarioDeFila(fila) } : NO_ENCONTRADO;
}

/** DELETE /api/admin/usuarios/:id — elimina la cuenta y sus sesiones (no la propia). */
export async function eliminarUsuario({ params, usuario }: Peticion): Promise<Respuesta> {
  const id = entero(params?.id);
  if (id === undefined) return NO_ENCONTRADO;
  if (id === usuario?.id) return { status: 400, body: { error: 'No puede eliminar su propia cuenta' } };
  const eliminado = await enTransaccion(async (cliente) => {
    const { rowCount } = await cliente.query('DELETE FROM usuarios WHERE id = $1', [id]);
    if (rowCount) await cerrarSesionesDe(id, cliente);
    return Boolean(rowCount);
  });
  return eliminado ? { status: 200, body: { ok: true, id } } : NO_ENCONTRADO;
}

/**
 * GET /api/admin/resumen — totales de usuarios y encuestas, y lo registrado en los últimos
 * 7 días (hoy incluido, hora de Bolivia). Los registros por día solo cuentan encuestas de
 * formularios: la base oficial se carga con db:seed y no son registros nuevos.
 */
export async function resumen(): Promise<Respuesta> {
  const { rows: u } = await pool.query<{ total: number; admins: number; activos: number }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE rol = 'admin')::int AS admins,
            count(*) FILTER (WHERE activo)::int AS activos
     FROM usuarios`
  );
  const porOrigen = async (tabla: 'titulados' | 'empleadores') => {
    const { rows } = await pool.query<{ base_oficial: number; formulario: number }>(
      `SELECT count(*) FILTER (WHERE origen = 'base_oficial')::int AS base_oficial,
              count(*) FILTER (WHERE origen = 'formulario')::int AS formulario
       FROM ${tabla}`
    );
    return { total: rows[0].base_oficial + rows[0].formulario, ...rows[0] };
  };
  const { rows: porDia } = await pool.query<{ fecha: string; titulados: number; empleadores: number; usuarios: number }>(
    `WITH dias AS (
       SELECT d::date AS fecha
       FROM generate_series((now() AT TIME ZONE $1)::date - 6, (now() AT TIME ZONE $1)::date, interval '1 day') AS d
     )
     SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha,
       (SELECT count(*) FROM titulados WHERE origen = 'formulario' AND (created_at AT TIME ZONE $1)::date = dias.fecha)::int AS titulados,
       (SELECT count(*) FROM empleadores WHERE origen = 'formulario' AND (created_at AT TIME ZONE $1)::date = dias.fecha)::int AS empleadores,
       (SELECT count(*) FROM usuarios WHERE (created_at AT TIME ZONE $1)::date = dias.fecha)::int AS usuarios
     FROM dias ORDER BY fecha`,
    [ZONA_HORARIA]
  );
  const suma = (campo: 'titulados' | 'empleadores' | 'usuarios') => porDia.reduce((s, d) => s + d[campo], 0);

  return {
    status: 200,
    body: {
      usuarios: u[0],
      titulados: await porOrigen('titulados'),
      empleadores: await porOrigen('empleadores'),
      ultimos_7_dias: {
        titulados: suma('titulados'),
        empleadores: suma('empleadores'),
        usuarios: suma('usuarios'),
        por_dia: porDia
      }
    }
  };
}
