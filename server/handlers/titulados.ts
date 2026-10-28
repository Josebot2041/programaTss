import { validarTituladoRecibido } from '../../src/utils/validacion';
import { enTransaccion, pool } from '../db';
import { insertarTitulado, leerIds, tituladoDeFila } from '../repositorio';
import type { Peticion, Respuesta } from './tipos';

/** GET /api/titulados */
export async function listarTitulados(): Promise<Respuesta> {
  const { rows } = await pool.query('SELECT * FROM v_titulados ORDER BY id');
  return { status: 200, body: rows.map(tituladoDeFila) };
}

/**
 * POST /api/titulados — mismas reglas que el formulario; el id lo asigna la base.
 * El titulado y sus selecciones múltiples se guardan en una sola transacción.
 */
export async function crearTitulado({ body }: Peticion): Promise<Respuesta> {
  const { errores, registro } = validarTituladoRecibido(body);
  if (!registro) return { status: 400, body: { errores } };
  const fila = await enTransaccion(async (cliente) => {
    const id = await insertarTitulado(cliente, await leerIds(cliente), registro, { origen: 'formulario' });
    const { rows } = await cliente.query('SELECT * FROM v_titulados WHERE id = $1', [id]);
    return rows[0];
  });
  return { status: 201, body: tituladoDeFila(fila) };
}
