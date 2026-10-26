/**
 * npm run db:init — crea las tablas definidas en db/schema.sql (no borra datos).
 */

import { readFile } from 'node:fs/promises';
import { pool } from '../db';

const RUTA_ESQUEMA = new URL('../../db/schema.sql', import.meta.url);

try {
  await pool.query(await readFile(RUTA_ESQUEMA, 'utf8'));
  console.log('Esquema aplicado: titulados, empleadores, items_empleadores');
} catch (err) {
  console.error('No se pudo aplicar el esquema:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
