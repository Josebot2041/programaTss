/**
 * Script: borrar-base-oficial.ts
 * Elimina todos los registros con origen = 'base_oficial' de la BD.
 * Deja únicamente los 184 titulados y 79 empleadores del formulario.
 *
 * Uso: npx tsx server/scripts/borrar-base-oficial.ts
 */
import 'dotenv/config';
import { pool, enTransaccion } from '../db.js';

await enTransaccion(async (cliente) => {
  console.log('=== Inicio de eliminación de base_oficial ===\n');

  // ── Titulados ────────────────────────────────────────────────────────────
  const { rowCount: ta } = await cliente.query(
    `DELETE FROM titulado_actividad
     WHERE titulado_id IN (SELECT id FROM titulados WHERE origen = 'base_oficial')`
  );
  console.log(`titulado_actividad eliminados: ${ta}`);

  const { rowCount: tau } = await cliente.query(
    `DELETE FROM titulado_aspecto_util
     WHERE titulado_id IN (SELECT id FROM titulados WHERE origen = 'base_oficial')`
  );
  console.log(`titulado_aspecto_util eliminados: ${tau}`);

  const { rowCount: tam } = await cliente.query(
    `DELETE FROM titulado_aspecto_mejorar
     WHERE titulado_id IN (SELECT id FROM titulados WHERE origen = 'base_oficial')`
  );
  console.log(`titulado_aspecto_mejorar eliminados: ${tam}`);

  const { rowCount: tav } = await cliente.query(
    `DELETE FROM titulado_asignatura_ventaja
     WHERE titulado_id IN (SELECT id FROM titulados WHERE origen = 'base_oficial')`
  );
  console.log(`titulado_asignatura_ventaja eliminados: ${tav}`);

  const { rowCount: tanu } = await cliente.query(
    `DELETE FROM titulado_asignatura_no_util
     WHERE titulado_id IN (SELECT id FROM titulados WHERE origen = 'base_oficial')`
  );
  console.log(`titulado_asignatura_no_util eliminados: ${tanu}`);

  const { rowCount: t } = await cliente.query(
    `DELETE FROM titulados WHERE origen = 'base_oficial'`
  );
  console.log(`titulados eliminados: ${t}\n`);

  // ── Empleadores ──────────────────────────────────────────────────────────
  const { rowCount: re } = await cliente.query(
    `DELETE FROM respuestas_empleador
     WHERE empleador_id IN (SELECT id FROM empleadores WHERE origen = 'base_oficial')`
  );
  console.log(`respuestas_empleador eliminadas: ${re}`);

  const { rowCount: ec } = await cliente.query(
    `DELETE FROM empleador_cargo
     WHERE empleador_id IN (SELECT id FROM empleadores WHERE origen = 'base_oficial')`
  );
  console.log(`empleador_cargo eliminados: ${ec}`);

  const { rowCount: e } = await cliente.query(
    `DELETE FROM empleadores WHERE origen = 'base_oficial'`
  );
  console.log(`empleadores eliminados: ${e}\n`);

  // ── Verificación final ───────────────────────────────────────────────────
  const { rows } = await cliente.query(`
    SELECT 'titulados'   AS tabla, origen, count(*)::int AS total FROM titulados   GROUP BY origen
    UNION ALL
    SELECT 'empleadores' AS tabla, origen, count(*)::int AS total FROM empleadores GROUP BY origen
    ORDER BY tabla, origen
  `);

  console.log('=== Estado final de la BD ===');
  rows.forEach((r) => console.log(`  ${r.tabla} [${r.origen}]: ${r.total}`));

  if (rows.length === 2) {
    const tRow = rows.find((r) => r.tabla === 'titulados');
    const eRow = rows.find((r) => r.tabla === 'empleadores');
    if (tRow?.total === 184 && eRow?.total === 79) {
      console.log('\n✅ Correcto: 184 titulados y 79 empleadores (solo formulario).');
    } else {
      console.log(`\n⚠️  Atención: se esperaban 184 titulados y 79 empleadores.`);
    }
  }
});

await pool.end();

