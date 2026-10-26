import { pool } from '../db';
import type { Respuesta } from './tipos';

/** GET /api/health — indica si la API y la base de datos responden. */
export async function health(): Promise<Respuesta> {
  try {
    await pool.query('SELECT 1');
    return { status: 200, body: { ok: true, db: true } };
  } catch {
    return { status: 503, body: { ok: false, db: false } };
  }
}
