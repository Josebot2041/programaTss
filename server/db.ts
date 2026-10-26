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
