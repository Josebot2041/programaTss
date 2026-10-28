import { validarEmpleadorRecibido } from '../../src/utils/validacion';
import { enTransaccion, pool } from '../db';
import { empleadorDeFila, insertarEmpleador, itemDeFila, leerIds } from '../repositorio';
import type { Peticion, Respuesta } from './tipos';

/** GET /api/empleadores */
export async function listarEmpleadores(): Promise<Respuesta> {
  const { rows } = await pool.query('SELECT * FROM v_empleadores ORDER BY id');
  return { status: 200, body: rows.map(empleadorDeFila) };
}

/**
 * POST /api/empleadores — mismas reglas que el formulario; el id lo asigna la base.
 * El empleador, sus cargos y sus 18 respuestas se guardan en una sola transacción.
 */
export async function crearEmpleador({ body }: Peticion): Promise<Respuesta> {
  const { errores, registro } = validarEmpleadorRecibido(body);
  if (!registro) return { status: 400, body: { errores } };
  const fila = await enTransaccion(async (cliente) => {
    const id = await insertarEmpleador(cliente, await leerIds(cliente), registro, { origen: 'formulario' });
    const { rows } = await cliente.query('SELECT * FROM v_empleadores WHERE id = $1', [id]);
    return rows[0];
  });
  return { status: 201, body: empleadorDeFila(fila) };
}

/** GET /api/items-empleadores — textos de las 18 afirmaciones. */
export async function listarItemsEmpleadores(): Promise<Respuesta> {
  const { rows } = await pool.query('SELECT codigo, afirmacion FROM items_empleadores ORDER BY codigo');
  return { status: 200, body: rows.map(itemDeFila) };
}
