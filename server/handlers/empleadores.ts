import { validarEmpleadorRecibido } from '../../src/utils/validacion';
import { pool } from '../db';
import { CAMPOS_EMPLEADOR, empleadorDeFila, itemDeFila, sqlInsertar, valoresEmpleador } from '../repositorio';
import type { Peticion, Respuesta } from './tipos';

/** GET /api/empleadores */
export async function listarEmpleadores(): Promise<Respuesta> {
  const { rows } = await pool.query('SELECT * FROM empleadores ORDER BY id');
  return { status: 200, body: rows.map(empleadorDeFila) };
}

/** POST /api/empleadores — mismas reglas que el formulario; el id lo asigna la base. */
export async function crearEmpleador({ body }: Peticion): Promise<Respuesta> {
  const { errores, registro } = validarEmpleadorRecibido(body);
  if (!registro) return { status: 400, body: { errores } };
  const { rows } = await pool.query(sqlInsertar('empleadores', CAMPOS_EMPLEADOR), [...valoresEmpleador(registro), 'formulario']);
  return { status: 201, body: empleadorDeFila(rows[0]) };
}

/** GET /api/items-empleadores — textos de las 18 afirmaciones. */
export async function listarItemsEmpleadores(): Promise<Respuesta> {
  const { rows } = await pool.query('SELECT codigo, afirmacion FROM items_empleadores ORDER BY codigo');
  return { status: 200, body: rows.map(itemDeFila) };
}
