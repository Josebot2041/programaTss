import { enTransaccion, pool } from '../db';
import {
  aplicarImportacion,
  compararConBase,
  descartarPrevisualizacion,
  ErrorArchivo,
  guardarPrevisualizacion,
  interpretarArchivo,
  MODOS,
  obtenerPrevisualizacion,
  totales,
  type Clasificacion,
  type Estado,
  type Modo
} from '../importacion';
import type { Peticion, Respuesta } from './tipos';

/** Problemas por fila que se devuelven (el total va aparte). */
const MAX_PROBLEMAS = 200;
const FILAS_MUESTRA = 10;

const contarEstados = (c: Clasificacion<unknown>) =>
  c.registros.reduce<Record<Estado, number>>((n, r) => ({ ...n, [r.estado]: n[r.estado] + 1 }), { nuevo: 0, sin_cambios: 0, cambia: 0, protegido: 0 });

const muestra = <T>(c: Clasificacion<T>) => c.registros.slice(0, FILAS_MUESTRA).map(({ registro, estado }) => ({ estado, registro }));

/**
 * POST /api/admin/importar/previsualizar — interpreta el archivo y lo compara con la base, sin
 * guardar nada. Devuelve un token para confirmar (vigente 15 minutos) y los datos interpretados,
 * que el panel también puede analizar sin guardarlos.
 */
export async function previsualizarImportacion({ archivo, usuario }: Peticion): Promise<Respuesta> {
  if (!archivo) return { status: 400, body: { error: 'Adjunte un archivo .xlsx o .csv en el campo «archivo».' } };
  let datos;
  try {
    const buffer = archivo.datos.buffer.slice(archivo.datos.byteOffset, archivo.datos.byteOffset + archivo.datos.byteLength) as ArrayBuffer;
    datos = await interpretarArchivo(buffer, archivo.nombre);
  } catch (err) {
    if (err instanceof ErrorArchivo) return { status: 400, body: { error: err.message } };
    // Un archivo dañado o que no es una hoja de cálculo hace fallar a SheetJS
    return { status: 400, body: { error: `No se pudo leer el archivo: ${err instanceof Error ? err.message : String(err)}` } };
  }

  const cliente = await pool.connect();
  let comparacion;
  try {
    comparacion = await compararConBase(cliente, datos);
  } finally {
    cliente.release();
  }
  const p = guardarPrevisualizacion(usuario!.id, archivo.nombre, datos);

  return {
    status: 200,
    body: {
      token: p.token,
      vence: new Date(p.vence).toISOString(),
      archivo: p.archivo,
      formato: datos.formato,
      cantidades: { titulados: datos.titulados.length, empleadores: datos.empleadores.length, items: datos.items.length },
      estados: { titulados: contarEstados(comparacion.titulados), empleadores: contarEstados(comparacion.empleadores) },
      porModo: Object.fromEntries(MODOS.map((m) => [m, totales(comparacion, m)])),
      problemas: datos.problemas.slice(0, MAX_PROBLEMAS),
      totalProblemas: datos.problemas.length,
      muestra: { titulados: muestra(comparacion.titulados), empleadores: muestra(comparacion.empleadores) },
      datos: { titulados: datos.titulados, empleadores: datos.empleadores, items: datos.items }
    }
  };
}

/**
 * POST /api/admin/importar/confirmar — guarda una previsualización con { token, modo }, todo en
 * una transacción: si algo falla, no se guarda ningún registro.
 */
export async function confirmarImportacion({ body, usuario }: Peticion): Promise<Respuesta> {
  const { token, modo } = (typeof body === 'object' && body !== null ? body : {}) as { token?: unknown; modo?: unknown };
  const errores: Record<string, string> = {};
  if (typeof token !== 'string' || token === '') errores.token = 'Falta el token de la previsualización';
  if (typeof modo !== 'string' || !(MODOS as readonly string[]).includes(modo)) errores.modo = `El modo debe ser ${MODOS.join(', ')}`;
  if (Object.keys(errores).length > 0) return { status: 400, body: { errores } };

  const p = obtenerPrevisualizacion(token as string, usuario!.id);
  if (!p) return { status: 410, body: { error: 'La previsualización venció o no existe. Vuelva a subir el archivo.' } };

  try {
    const resultado = await enTransaccion((cliente) => aplicarImportacion(cliente, p, modo as Modo));
    descartarPrevisualizacion(p.token);
    return { status: 200, body: resultado };
  } catch (err) {
    console.error('Importación fallida:', err);
    // El detalle queda en el log del servidor; al cliente no se le envían errores internos
    return { status: 500, body: { error: 'No se pudo guardar la importación; no se guardó ningún registro.' } };
  }
}

/** GET /api/admin/importaciones — historial, de la más reciente a la más antigua. */
export async function listarImportaciones(): Promise<Respuesta> {
  const { rows } = await pool.query(
    `SELECT i.id, i.archivo, i.modo, i.insertados, i.actualizados, i.omitidos, i.eliminados, i.created_at,
            u.nombre_completo AS usuario
     FROM importaciones i LEFT JOIN usuarios u ON u.id = i.usuario_id
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT 100`
  );
  return { status: 200, body: rows };
}
