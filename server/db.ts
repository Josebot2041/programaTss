/**
 * Conexión a PostgreSQL. La cadena de conexión se lee de DATABASE_URL (archivo .env).
 */

import 'dotenv/config';
import pg from 'pg';

const cadena = process.env.DATABASE_URL;
if (!cadena) {
  throw new Error('Falta la variable DATABASE_URL (copie .env.example a .env y complétela)');
}

export const pool = new pg.Pool({ connectionString: cadena });

/** Ejecuta fn en una transacción: COMMIT si termina bien, ROLLBACK si lanza un error. */
export async function enTransaccion<T>(fn: (cliente: pg.PoolClient) => Promise<T>): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}
