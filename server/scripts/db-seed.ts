/**
 * npm run db:seed — carga public/data/Base_Limpia_Titulados_Empleadores.xlsx en PostgreSQL
 * usando el mismo importador que la aplicación.
 *
 * Se puede ejecutar varias veces: cada registro se identifica por su id de la base oficial
 * (INSERT … ON CONFLICT), así que una segunda corrida actualiza en lugar de duplicar. Nunca
 * modifica registros cargados desde los formularios.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { importarArchivo, NOMBRE_BASE_REAL } from '../../src/utils/importador';
import { CAMPOS_EMPLEADOR, CAMPOS_TITULADO, identificador, valoresEmpleador, valoresTitulado, type Tabla } from '../repositorio';

const RUTA_EXCEL = fileURLToPath(new URL(`../../public/data/${NOMBRE_BASE_REAL}`, import.meta.url));

if (!existsSync(RUTA_EXCEL)) {
  console.error(`No se encontró el archivo ${RUTA_EXCEL}`);
  console.error('Copie la base oficial en public/data/ y vuelva a ejecutar npm run db:seed.');
  process.exit(1);
}

// Se importa después de comprobar el archivo para no exigir DATABASE_URL si falta el Excel.
const { pool } = await import('../db');

const archivo = await readFile(RUTA_EXCEL);
const resultado = await importarArchivo(
  archivo.buffer.slice(archivo.byteOffset, archivo.byteOffset + archivo.byteLength) as ArrayBuffer,
  NOMBRE_BASE_REAL
);

for (const p of resultado.problemas) {
  const ubicacion = `${p.hoja}, fila ${p.fila}${p.columna ? `, columna ${p.columna}` : ''}`;
  console.warn(`[${p.severidad}] ${ubicacion}: ${p.mensaje}${p.valor ? ` (${p.valor})` : ''}`);
}

const titulados = resultado.titulados ?? [];
const empleadores = resultado.empleadores ?? [];
const items = resultado.items ?? [];

if (titulados.length === 0 || empleadores.length === 0) {
  console.error('El archivo no tiene titulados o empleadores válidos; no se cargó nada.');
  await pool.end();
  process.exit(1);
}

const idNumerico = (id: string) => {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) throw new Error(`El id «${id}» no es un entero positivo`);
  return n;
};

/**
 * INSERT con todos los valores como parámetros ($1, $2, …). Si el id ya existe y es de la base
 * oficial, se actualiza; si pertenece a un formulario, no se toca (la fila no se devuelve).
 */
function sqlUpsert(tabla: Tabla, campos: string[]): string {
  const t = identificador(tabla);
  const columnas = ['id', ...campos, 'origen'].map(identificador);
  const parametros = columnas.map((_, i) => `$${i + 1}`);
  const asignaciones = campos.map((c) => `${identificador(c)} = EXCLUDED.${identificador(c)}`).join(', ');
  return `INSERT INTO ${t} (${columnas.join(', ')}) VALUES (${parametros.join(', ')})
    ON CONFLICT (id) DO UPDATE SET ${asignaciones} WHERE ${t}.origen = 'base_oficial'
    RETURNING (xmax = 0) AS insertado`;
}

interface Conteo {
  insertados: number;
  actualizados: number;
  omitidos: string[];
}

const cliente = await pool.connect();
try {
  await cliente.query('BEGIN');

  const cargar = async <T extends { id: string }>(tabla: Tabla, campos: string[], registros: T[], valores: (r: T) => unknown[]) => {
    const sql = sqlUpsert(tabla, campos);
    const conteo: Conteo = { insertados: 0, actualizados: 0, omitidos: [] };
    for (const r of registros) {
      const { rows } = await cliente.query<{ insertado: boolean }>(sql, [idNumerico(r.id), ...valores(r), 'base_oficial']);
      if (rows.length === 0) conteo.omitidos.push(r.id);
      else if (rows[0].insertado) conteo.insertados++;
      else conteo.actualizados++;
    }
    // Las encuestas nuevas reciben ids a partir del mayor existente.
    await cliente.query(
      `SELECT setval(pg_get_serial_sequence($1, 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM ${identificador(tabla)}), false)`,
      [tabla]
    );
    return conteo;
  };

  const cTit = await cargar('titulados', CAMPOS_TITULADO, titulados, valoresTitulado);
  const cEmp = await cargar('empleadores', CAMPOS_EMPLEADOR, empleadores, valoresEmpleador);

  for (const item of items) {
    await cliente.query(
      `INSERT INTO items_empleadores (codigo, afirmacion, origen) VALUES ($1, $2, 'base_oficial')
       ON CONFLICT (codigo) DO UPDATE SET afirmacion = EXCLUDED.afirmacion`,
      [item.codigo, item.afirmacion]
    );
  }

  await cliente.query('COMMIT');

  const informe = (nombre: string, c: Conteo) => {
    console.log(`${nombre}: ${c.insertados} nuevos, ${c.actualizados} actualizados`);
    if (c.omitidos.length > 0) {
      console.warn(`  ${c.omitidos.length} omitidos porque su id ya lo usa un formulario: ${c.omitidos.join(', ')}`);
    }
  };
  informe('Titulados', cTit);
  informe('Empleadores', cEmp);
  console.log(`Afirmaciones de empleadores: ${items.length}`);
} catch (err) {
  await cliente.query('ROLLBACK');
  console.error('No se pudo cargar la base:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  cliente.release();
  await pool.end();
}
