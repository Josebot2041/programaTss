/**
 * Elimina de PostgreSQL todos los registros de la base oficial (origen = 'base_oficial'):
 * titulados y empleadores, con sus selecciones múltiples y respuestas (caen en cascada).
 * No toca las encuestas guardadas desde la web (origen = 'formulario') ni las importadas desde el
 * panel (origen = 'importacion'). Para volver a cargar la base oficial: npm run db:seed.
 *
 * Es destructivo, así que no tiene script en package.json y pide dos confirmaciones:
 *
 *   npx tsx server/scripts/borrar-base-oficial.ts --confirmar
 *
 * y después escribir BORRAR en la consola.
 */

import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { confirmar: { type: 'boolean', default: false } } });

if (!values.confirmar) {
  console.error('Este script elimina todos los registros de la base oficial (origen = base_oficial).');
  console.error('Para ejecutarlo: npx tsx server/scripts/borrar-base-oficial.ts --confirmar');
  process.exit(1);
}

// Se importa aquí para no exigir DATABASE_URL si falta --confirmar.
const { enTransaccion, pool } = await import('../db');

const contar = async () =>
  (
    await pool.query<{ tabla: string; origen: string; total: number }>(
      `SELECT 'titulados' AS tabla, origen, count(*)::int AS total FROM titulados GROUP BY origen
       UNION ALL
       SELECT 'empleadores', origen, count(*)::int FROM empleadores GROUP BY origen
       ORDER BY 1, 2`
    )
  ).rows;

try {
  const antes = await contar();
  const oficiales = (tabla: string) => antes.find((r) => r.tabla === tabla && r.origen === 'base_oficial')?.total ?? 0;
  console.log(`Se eliminarán ${oficiales('titulados')} titulados y ${oficiales('empleadores')} empleadores de la base oficial.`);
  console.log('Las encuestas de la web y las importadas desde el panel no se tocan.');

  const consola = createInterface({ input: process.stdin, output: process.stdout });
  const respuesta = await consola.question('Escriba BORRAR para confirmar: ');
  consola.close();
  if (respuesta.trim() !== 'BORRAR') {
    console.log('No se escribió BORRAR: no se eliminó nada.');
    process.exitCode = 1;
  } else {
    await enTransaccion(async (cliente) => {
      await cliente.query(`DELETE FROM titulados WHERE origen = 'base_oficial'`);
      await cliente.query(`DELETE FROM empleadores WHERE origen = 'base_oficial'`);
    });
    console.log('Registros por origen después de borrar:');
    for (const r of await contar()) console.log(`  ${r.tabla} [${r.origen}]: ${r.total}`);
  }
} catch (err) {
  console.error('No se pudo borrar la base oficial:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
