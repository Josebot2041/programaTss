/**
 * npm run db:init — crea las tablas y vistas definidas en db/schema.sql (no borra datos).
 *
 * Si encuentra las tablas del esquema anterior (sin normalizar: titulados con columnas de
 * arreglo, empleadores con item_01 … item_18), las mueve al esquema "legacy" antes de crear
 * las nuevas. npm run db:seed migra después los registros de formularios y elimina "legacy".
 */

import { readFile } from 'node:fs/promises';
import { enTransaccion, pool } from '../db';

const RUTA_ESQUEMA = new URL('../../db/schema.sql', import.meta.url);

/** Tablas del esquema anterior presentes en el esquema actual. */
async function tablasAnteriores(cliente: { query: typeof pool.query }): Promise<string[]> {
  const { rows } = await cliente.query<{ table_name: string }>(
    `SELECT DISTINCT table_name FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND ((table_name = 'titulados' AND column_name = 'actividades')
         OR (table_name = 'empleadores' AND column_name = 'item_01'))`
  );
  // items_empleadores no cambió de forma, pero se recrea para que tenga las restricciones nuevas.
  return rows.length > 0 ? ['titulados', 'empleadores', 'items_empleadores'] : [];
}

try {
  const esquema = await readFile(RUTA_ESQUEMA, 'utf8');
  const movidas = await enTransaccion(async (cliente) => {
    const anteriores = await tablasAnteriores(cliente);
    if (anteriores.length > 0) {
      await cliente.query('CREATE SCHEMA IF NOT EXISTS legacy');
      for (const tabla of anteriores) await cliente.query(`ALTER TABLE ${tabla} SET SCHEMA legacy`);
    }
    await cliente.query(esquema);
    return anteriores;
  });
  console.log('Esquema aplicado: catálogos, encuestas, tablas intermedias y vistas v_titulados / v_empleadores');
  if (movidas.length > 0) {
    console.log(`Se encontró el esquema anterior: ${movidas.join(', ')} se movieron al esquema "legacy".`);
    console.log('Ejecute npm run db:seed para cargar los datos (migra los registros de formularios y elimina "legacy").');
  }
} catch (err) {
  console.error('No se pudo aplicar el esquema:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
