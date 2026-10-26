import { validarTituladoRecibido } from '../../src/utils/validacion';
import { pool } from '../db';
import { CAMPOS_TITULADO, sqlInsertar, tituladoDeFila, valoresTitulado } from '../repositorio';
import type { Peticion, Respuesta } from './tipos';

/** GET /api/titulados */
export async function listarTitulados(): Promise<Respuesta> {
  const { rows } = await pool.query('SELECT * FROM titulados ORDER BY id');
  return { status: 200, body: rows.map(tituladoDeFila) };
}

/** POST /api/titulados — mismas reglas que el formulario; el id lo asigna la base. */
export async function crearTitulado({ body }: Peticion): Promise<Respuesta> {
  const { errores, registro } = validarTituladoRecibido(body);
  if (!registro) return { status: 400, body: { errores } };
  const { rows } = await pool.query(sqlInsertar('titulados', CAMPOS_TITULADO), [...valoresTitulado(registro), 'formulario']);
  return { status: 201, body: tituladoDeFila(rows[0]) };
}
