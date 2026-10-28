/**
 * npm run db:seed — carga public/data/Base_Limpia_Titulados_Empleadores.xlsx en PostgreSQL
 * usando el mismo importador que la aplicación. Todo ocurre en una sola transacción:
 *
 *   1. Catálogos (desde src/data/catalogos.ts) y escalas Likert.
 *   2. Afirmaciones de empleadores (hoja Items_empleadores).
 *   3. Titulados y empleadores de la base oficial, con sus selecciones y respuestas.
 *   4. Si db:init movió un esquema anterior a "legacy", migra sus registros de formularios
 *      y elimina "legacy".
 *
 * Se puede ejecutar varias veces: cada registro oficial se identifica por su id; si ya existe
 * se reemplaza (conservando su fecha de creación) en lugar de duplicarse. Nunca modifica
 * registros cargados desde los formularios.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { LIKERT_EMPLEADOR, LIKERT_TITULADOS } from '../../src/data/catalogos';
import { importarArchivo, NOMBRE_BASE_REAL } from '../../src/utils/importador';
import {
  CATALOGOS,
  CODIGOS_LIKERT_EMPLEADOR,
  empleadorDeFila,
  identificador,
  insertarEmpleador,
  insertarTitulado,
  leerIds,
  tituladoDeFila,
  type DatosInsercion,
  type Ids,
  type Tabla
} from '../repositorio';

const RUTA_EXCEL = fileURLToPath(new URL(`../../public/data/${NOMBRE_BASE_REAL}`, import.meta.url));

if (!existsSync(RUTA_EXCEL)) {
  console.error(`No se encontró el archivo ${RUTA_EXCEL}`);
  console.error('Copie la base oficial en public/data/ y vuelva a ejecutar npm run db:seed.');
  process.exit(1);
}

// Se importa después de comprobar el archivo para no exigir DATABASE_URL si falta el Excel.
const { enTransaccion, pool } = await import('../db');

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

/** Inserta los valores que falten de cada catálogo, en el orden de catalogos.ts. Devuelve cuántos agregó. */
async function cargarCatalogos(cliente: pg.ClientBase): Promise<number> {
  let nuevos = 0;
  for (const [tabla, valores] of Object.entries(CATALOGOS)) {
    const r = await cliente.query(
      `INSERT INTO ${identificador(tabla)} (nombre)
       SELECT nombre FROM unnest($1::text[]) WITH ORDINALITY AS x(nombre, n) ORDER BY n
       ON CONFLICT (nombre) DO NOTHING`,
      [valores]
    );
    nuevos += r.rowCount ?? 0;
  }
  // En la escala de titulados el id es el valor: 1 = Totalmente en desacuerdo … 4
  for (const [i, nombre] of LIKERT_TITULADOS.entries()) {
    const r = await cliente.query(
      `INSERT INTO escala_likert_titulado (id, nombre) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [i + 1, nombre]
    );
    nuevos += r.rowCount ?? 0;
  }
  for (const [i, nombre] of LIKERT_EMPLEADOR.entries()) {
    const r = await cliente.query(
      `INSERT INTO escala_likert_empleador (codigo, nombre) VALUES ($1, $2) ON CONFLICT (codigo) DO NOTHING`,
      [CODIGOS_LIKERT_EMPLEADOR[i], nombre]
    );
    nuevos += r.rowCount ?? 0;
  }
  return nuevos;
}

interface Conteo {
  insertados: number;
  actualizados: number;
  omitidos: string[];
}

/**
 * Carga los registros oficiales de una tabla. Un registro ya cargado se borra (sus selecciones
 * y respuestas caen en cascada) y se vuelve a insertar con su misma fecha de creación.
 */
async function cargarOficiales<T extends { id: string }>(
  cliente: pg.ClientBase,
  tabla: Tabla,
  registros: T[],
  insertar: (cliente: pg.ClientBase, ids: Ids, r: T, datos: DatosInsercion) => Promise<number>,
  ids: Ids
): Promise<Conteo> {
  const conteo: Conteo = { insertados: 0, actualizados: 0, omitidos: [] };
  for (const r of registros) {
    const id = idNumerico(r.id);
    const { rows } = await cliente.query<{ origen: string; created_at: Date }>(
      `SELECT origen, created_at FROM ${identificador(tabla)} WHERE id = $1`,
      [id]
    );
    const existente = rows[0];
    if (existente?.origen === 'formulario') {
      conteo.omitidos.push(r.id);
      continue;
    }
    if (existente) {
      await cliente.query(`DELETE FROM ${identificador(tabla)} WHERE id = $1`, [id]);
      conteo.actualizados++;
    } else {
      conteo.insertados++;
    }
    await insertar(cliente, ids, r, { origen: 'base_oficial', id, creado: existente?.created_at });
  }
  return conteo;
}

/** Migra los registros de formularios del esquema anterior (si existe) y lo elimina. */
async function migrarEsquemaAnterior(cliente: pg.ClientBase, ids: Ids): Promise<{ titulados: number; empleadores: number } | undefined> {
  const { rows } = await cliente.query<{ existe: boolean }>(`SELECT to_regclass('legacy.titulados') IS NOT NULL AS existe`);
  if (!rows[0].existe) return undefined;

  const formularios = async (tabla: Tabla) =>
    (await cliente.query(`SELECT * FROM legacy.${identificador(tabla)} WHERE origen = 'formulario' ORDER BY id`)).rows;
  const datos = (fila: Record<string, unknown>): DatosInsercion => ({
    origen: 'formulario',
    id: fila.id as number,
    creado: fila.created_at as Date
  });

  // Las filas del esquema anterior tienen el mismo formato plano que las vistas.
  const tit = await formularios('titulados');
  for (const fila of tit) await insertarTitulado(cliente, ids, tituladoDeFila(fila), datos(fila));
  const emp = await formularios('empleadores');
  for (const fila of emp) await insertarEmpleador(cliente, ids, empleadorDeFila(fila), datos(fila));

  await cliente.query('DROP SCHEMA legacy CASCADE');
  return { titulados: tit.length, empleadores: emp.length };
}

try {
  const informe = await enTransaccion(async (cliente) => {
    const catalogos = await cargarCatalogos(cliente);

    for (const item of items) {
      await cliente.query(
        `INSERT INTO items_empleadores (codigo, afirmacion, origen) VALUES ($1, $2, 'base_oficial')
         ON CONFLICT (codigo) DO UPDATE SET afirmacion = EXCLUDED.afirmacion`,
        [item.codigo, item.afirmacion]
      );
    }

    const ids = await leerIds(cliente);
    const cTit = await cargarOficiales(cliente, 'titulados', titulados, insertarTitulado, ids);
    const cEmp = await cargarOficiales(cliente, 'empleadores', empleadores, insertarEmpleador, ids);
    const migrados = await migrarEsquemaAnterior(cliente, ids);

    // Las encuestas nuevas reciben ids a partir del mayor existente.
    for (const tabla of ['titulados', 'empleadores'] as const) {
      await cliente.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM ${identificador(tabla)}), false)`,
        [tabla]
      );
    }
    return { catalogos, cTit, cEmp, migrados };
  });

  const linea = (nombre: string, c: Conteo) => {
    console.log(`${nombre}: ${c.insertados} nuevos, ${c.actualizados} actualizados`);
    if (c.omitidos.length > 0) {
      console.warn(`  ${c.omitidos.length} omitidos porque su id ya lo usa un formulario: ${c.omitidos.join(', ')}`);
    }
  };
  console.log(`Catálogos: ${informe.catalogos} valores nuevos`);
  console.log(`Afirmaciones de empleadores: ${items.length}`);
  linea('Titulados', informe.cTit);
  linea('Empleadores', informe.cEmp);
  if (informe.migrados) {
    console.log(
      `Esquema anterior: se migraron ${informe.migrados.titulados} titulados y ${informe.migrados.empleadores} empleadores de formularios; se eliminó "legacy".`
    );
  }
} catch (err) {
  console.error('No se pudo cargar la base:', err instanceof Error ? err.message : err);
  if (err instanceof Error && /does not exist|no existe/.test(err.message)) console.error('¿Ejecutó npm run db:init?');
  process.exitCode = 1;
} finally {
  await pool.end();
}
