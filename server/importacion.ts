/**
 * Importación de archivos desde el panel (Base de datos → Importar), sin dependencias de Express:
 *
 *   1. interpretarArchivo: acepta la base limpia (hojas Titulados / Empleadores / Items_empleadores
 *      o un CSV) y los Excel crudos de los formularios oficiales, que limpia con limpiezaEncuestas.
 *   2. clasificar: compara cada registro con la base por su Id (nuevo, sin cambios, cambia o
 *      protegido si el Id es de una encuesta guardada desde la web).
 *   3. aplicarImportacion: guarda según el modo, dentro de la transacción que recibe.
 *
 * Las encuestas de origen 'formulario' nunca se modifican ni se borran, en ningún modo.
 */

import { randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type pg from 'pg';
import * as XLSX from 'xlsx';
import { MODOS_IMPORTACION, type ModoImportacion } from '../src/data/catalogos';
import type { Empleador, ItemEmpleador, Titulado } from '../src/types';
import { importarArchivo, leerHojas } from '../src/utils/importador';
import { esCrudoEmpleadores, esCrudoTitulados, filasItems, limpiarEmpleadores, limpiarTitulados, type ParteLimpia } from './limpiezaEncuestas';
import { empleadorDeFila, identificador, insertarEmpleador, insertarTitulado, leerIds, tituladoDeFila, type Tabla } from './repositorio';

export const MODOS = MODOS_IMPORTACION;
export type Modo = ModoImportacion;

export type Formato = 'base_limpia' | 'titulados_crudo' | 'empleadores_crudo';
export type Estado = 'nuevo' | 'sin_cambios' | 'cambia' | 'protegido';

export interface ProblemaFila {
  hoja: string;
  /** Fila del archivo (base limpia) o Id de la respuesta (Excel crudo). */
  fila?: number;
  id?: string;
  columna?: string;
  valor?: string;
  mensaje: string;
  severidad: 'error' | 'advertencia';
}

export interface ArchivoInterpretado {
  formato: Formato;
  titulados: Titulado[];
  empleadores: Empleador[];
  items: ItemEmpleador[];
  problemas: ProblemaFila[];
}

/** El archivo no se puede importar (formato desconocido, sin registros…): error del usuario, no del servidor. */
export class ErrorArchivo extends Error {}

// ---------------------------------------------------------------------------
// 1. Interpretar el archivo
// ---------------------------------------------------------------------------

/** Los Ids deben ser enteros positivos (son la clave en la base). */
function conIdValido<T extends { id: string }>(hoja: string, registros: T[], problemas: ProblemaFila[]): T[] {
  return registros.filter((r) => {
    const n = Number(r.id);
    if (Number.isInteger(n) && n > 0) return true;
    problemas.push({ hoja, id: r.id, columna: 'id', valor: r.id, mensaje: 'El Id no es un entero positivo; fila descartada', severidad: 'error' });
    return false;
  });
}

/** Pasa las filas limpias por el importador de la aplicación, igual que la base limpia. */
async function desdeCrudo(formato: Formato, parte: ParteLimpia, hoja: 'Titulados' | 'Empleadores'): Promise<ArchivoInterpretado> {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(parte.filas), hoja);
  if (hoja === 'Empleadores') XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filasItems()), 'Items_empleadores');
  const r = await importarArchivo(XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer, `${hoja}.xlsx`);
  const problemas: ProblemaFila[] = [
    ...parte.descartes.map((d): ProblemaFila => ({ hoja: d.hoja, id: d.id, mensaje: `${d.motivo}; respuesta descartada`, severidad: 'error' })),
    ...parte.correcciones.map(
      (c): ProblemaFila => ({ hoja: c.hoja, id: c.id, columna: c.columna, valor: c.antes, mensaje: c.despues ? `${c.motivo} (→ ${c.despues})` : c.motivo, severidad: 'advertencia' })
    ),
    ...r.problemas
  ];
  return {
    formato,
    titulados: conIdValido('Titulados', r.titulados ?? [], problemas),
    empleadores: conIdValido('Empleadores', r.empleadores ?? [], problemas),
    items: r.items ?? [],
    problemas
  };
}

/** Detecta el formato por las columnas y devuelve los registros listos para guardar. */
export async function interpretarArchivo(datos: ArrayBuffer, nombre: string): Promise<ArchivoInterpretado> {
  const hojas = await leerHojas(datos, nombre);
  const primera = hojas[0]?.filas ?? [];
  const encabezado = primera[0] ?? [];

  let resultado: ArchivoInterpretado;
  if (esCrudoTitulados(encabezado)) {
    resultado = await desdeCrudo('titulados_crudo', limpiarTitulados(primera), 'Titulados');
  } else if (esCrudoEmpleadores(encabezado)) {
    resultado = await desdeCrudo('empleadores_crudo', limpiarEmpleadores(primera), 'Empleadores');
  } else {
    const r = await importarArchivo(datos, nombre);
    if (r.titulados === undefined && r.empleadores === undefined) {
      throw new ErrorArchivo(
        'No se reconoce el formato. Use la base limpia (hojas Titulados, Empleadores e Items_empleadores, o un CSV con sus columnas) o el Excel exportado de Microsoft Forms (titulados) o Google Forms (empleadores).'
      );
    }
    const problemas: ProblemaFila[] = [...r.problemas];
    resultado = {
      formato: 'base_limpia',
      titulados: conIdValido('Titulados', r.titulados ?? [], problemas),
      empleadores: conIdValido('Empleadores', r.empleadores ?? [], problemas),
      items: r.items ?? [],
      problemas
    };
  }
  if (resultado.titulados.length === 0 && resultado.empleadores.length === 0) {
    throw new ErrorArchivo('El archivo no tiene titulados ni empleadores válidos.');
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// 2. Comparar con la base
// ---------------------------------------------------------------------------

export interface Clasificado<T> {
  registro: T;
  estado: Estado;
  /** Fecha de creación del registro existente (se conserva al actualizarlo). */
  creado?: Date;
}

export interface Clasificacion<T> {
  registros: Array<Clasificado<T>>;
  /** Ids de la base oficial que no están en el archivo (los quita reemplazar_oficial). */
  oficialesFuera: number[];
}

/** Forma comparable: JSON, sin valores vacíos y con las listas sin importar el orden. */
const comparable = (r: object) => JSON.parse(JSON.stringify(r, (_k, v) => (Array.isArray(v) ? [...v].sort() : v)));

async function clasificar<T extends { id: string }>(db: pg.ClientBase, tabla: Tabla, registros: T[], deFila: (f: Record<string, unknown>) => T): Promise<Clasificacion<T>> {
  const ids = registros.map((r) => Number(r.id));
  const vista = tabla === 'titulados' ? 'v_titulados' : 'v_empleadores';
  const { rows } = await db.query(`SELECT * FROM ${identificador(vista)} WHERE id = ANY ($1::int[])`, [ids]);
  const existentes = new Map(rows.map((f) => [Number(f.id), f as Record<string, unknown>]));
  const clasificados = registros.map((registro): Clasificado<T> => {
    const fila = existentes.get(Number(registro.id));
    if (!fila) return { registro, estado: 'nuevo' };
    if (fila.origen === 'formulario') return { registro, estado: 'protegido' };
    const igual = isDeepStrictEqual(comparable(deFila(fila)), comparable(registro));
    return { registro, estado: igual ? 'sin_cambios' : 'cambia', creado: fila.created_at as Date };
  });
  // Un archivo sin registros de esta tabla (p. ej. el Excel crudo de titulados no trae empleadores)
  // no la reemplaza: reemplazar_oficial solo quita registros de las tablas que el archivo trae.
  if (registros.length === 0) return { registros: clasificados, oficialesFuera: [] };
  const { rows: fuera } = await db.query<{ id: number }>(
    `SELECT id FROM ${identificador(tabla)} WHERE origen = 'base_oficial' AND NOT (id = ANY ($1::int[])) ORDER BY id`,
    [ids]
  );
  return { registros: clasificados, oficialesFuera: fuera.map((f) => f.id) };
}

export interface Comparacion {
  titulados: Clasificacion<Titulado>;
  empleadores: Clasificacion<Empleador>;
}

export async function compararConBase(db: pg.ClientBase, archivo: Pick<ArchivoInterpretado, 'titulados' | 'empleadores'>): Promise<Comparacion> {
  return {
    titulados: await clasificar(db, 'titulados', archivo.titulados, (f) => tituladoDeFila(f)),
    empleadores: await clasificar(db, 'empleadores', archivo.empleadores, (f) => empleadorDeFila(f))
  };
}

export interface Plan<T> {
  insertar: Array<Clasificado<T>>;
  actualizar: Array<Clasificado<T>>;
  eliminar: number[];
  omitidos: number;
}

/**
 * Qué hace cada modo:
 * - agregar: inserta los Ids nuevos; no toca los existentes.
 * - actualizar: además, reemplaza los existentes que cambian (los iguales se dejan como están).
 * - reemplazar_oficial: además, quita de la base oficial los registros que no están en el archivo
 *   (solo en las tablas que el archivo trae).
 * Los Ids que son encuestas guardadas desde la web (protegidos) siempre se omiten.
 */
export function planificar<T>(c: Clasificacion<T>, modo: Modo): Plan<T> {
  const insertar = c.registros.filter((r) => r.estado === 'nuevo');
  const actualizar = modo === 'agregar' ? [] : c.registros.filter((r) => r.estado === 'cambia');
  return {
    insertar,
    actualizar,
    eliminar: modo === 'reemplazar_oficial' ? c.oficialesFuera : [],
    omitidos: c.registros.length - insertar.length - actualizar.length
  };
}

export interface Totales {
  insertados: number;
  actualizados: number;
  omitidos: number;
  eliminados: number;
}

export function totales(comparacion: Comparacion, modo: Modo): Totales {
  const planes = [planificar(comparacion.titulados, modo), planificar(comparacion.empleadores, modo)];
  return {
    insertados: planes.reduce((s, p) => s + p.insertar.length, 0),
    actualizados: planes.reduce((s, p) => s + p.actualizar.length, 0),
    omitidos: planes.reduce((s, p) => s + p.omitidos, 0),
    eliminados: planes.reduce((s, p) => s + p.eliminar.length, 0)
  };
}

// ---------------------------------------------------------------------------
// Previsualizaciones pendientes (tabla importaciones_pendientes, 15 minutos)
// ---------------------------------------------------------------------------

export const VIGENCIA_PREVISUALIZACION_MS = 15 * 60 * 1000;
/** Pendientes que se conservan por usuario: las más antiguas se descartan. */
const MAX_PENDIENTES_POR_USUARIO = 10;

/** Pool o cliente de una transacción. */
type Consultas = Pick<pg.ClientBase, 'query'>;

export interface Previsualizacion {
  token: string;
  usuarioId: number;
  archivo: string;
  vence: number;
  datos: ArchivoInterpretado;
}

const borrarVencidas = (db: Consultas) => db.query('DELETE FROM importaciones_pendientes WHERE expira_en <= now()');

/**
 * Guarda los registros interpretados hasta que se confirmen (o venzan). Así la confirmación
 * funciona aunque la API se reinicie o corra en varios procesos.
 */
export async function guardarPrevisualizacion(db: Consultas, usuarioId: number, archivo: string, datos: ArchivoInterpretado): Promise<Previsualizacion> {
  await borrarVencidas(db);
  const token = randomBytes(24).toString('base64url');
  const { rows } = await db.query<{ expira_en: Date }>(
    `INSERT INTO importaciones_pendientes (token, usuario_id, archivo, datos, expira_en)
     VALUES ($1, $2, $3, $4, now() + $5 * interval '1 millisecond')
     RETURNING expira_en`,
    [token, usuarioId, archivo, JSON.stringify(datos), VIGENCIA_PREVISUALIZACION_MS]
  );
  await db.query(
    `DELETE FROM importaciones_pendientes
     WHERE usuario_id = $1
       AND token NOT IN (SELECT token FROM importaciones_pendientes WHERE usuario_id = $1 ORDER BY created_at DESC, token LIMIT $2)`,
    [usuarioId, MAX_PENDIENTES_POR_USUARIO]
  );
  return { token, usuarioId, archivo, vence: rows[0].expira_en.getTime(), datos };
}

/** La previsualización vigente de ese usuario, o undefined si venció, no existe o es de otro. */
export async function obtenerPrevisualizacion(db: Consultas, token: string, usuarioId: number): Promise<Previsualizacion | undefined> {
  await borrarVencidas(db);
  const { rows } = await db.query<{ archivo: string; datos: ArchivoInterpretado; expira_en: Date }>(
    'SELECT archivo, datos, expira_en FROM importaciones_pendientes WHERE token = $1 AND usuario_id = $2 AND expira_en > now()',
    [token, usuarioId]
  );
  const f = rows[0];
  return f && { token, usuarioId, archivo: f.archivo, vence: f.expira_en.getTime(), datos: f.datos };
}

export async function descartarPrevisualizacion(db: Consultas, token: string) {
  await db.query('DELETE FROM importaciones_pendientes WHERE token = $1', [token]);
}

// ---------------------------------------------------------------------------
// 3. Guardar
// ---------------------------------------------------------------------------

export interface ResultadoImportacion extends Totales {
  id: number;
  archivo: string;
  modo: Modo;
  created_at: string;
}

/**
 * Guarda la importación. Debe llamarse dentro de una transacción (enTransaccion): si algo falla,
 * no queda ningún registro guardado. Vuelve a comparar con la base, por si cambió desde la
 * previsualización.
 */
export async function aplicarImportacion(db: pg.ClientBase, p: Previsualizacion, modo: Modo): Promise<ResultadoImportacion> {
  const { rows } = await db.query<{ id: number; created_at: Date }>(
    'INSERT INTO importaciones (usuario_id, archivo, modo) VALUES ($1, $2, $3) RETURNING id, created_at',
    [p.usuarioId, p.archivo, modo]
  );
  const importacionId = rows[0].id;
  const ids = await leerIds(db);
  const comparacion = await compararConBase(db, p.datos);

  const guardar = async <T extends { id: string }>(
    tabla: Tabla,
    plan: Plan<T>,
    insertar: (db: pg.ClientBase, ids: Awaited<ReturnType<typeof leerIds>>, r: T, datos: Parameters<typeof insertarTitulado>[3]) => Promise<number>
  ) => {
    for (const id of plan.eliminar) {
      await db.query(`DELETE FROM ${identificador(tabla)} WHERE id = $1 AND origen = 'base_oficial'`, [id]);
    }
    // Actualizar = reemplazar el registro (sus listas y respuestas caen en cascada) con el mismo Id y fecha
    for (const { registro, creado } of plan.actualizar) {
      await db.query(`DELETE FROM ${identificador(tabla)} WHERE id = $1 AND origen <> 'formulario'`, [Number(registro.id)]);
      await insertar(db, ids, registro, { origen: 'importacion', id: Number(registro.id), creado, importacionId });
    }
    for (const { registro } of plan.insertar) {
      await insertar(db, ids, registro, { origen: 'importacion', id: Number(registro.id), importacionId });
    }
    // Las encuestas nuevas de la web reciben ids a partir del mayor existente
    await db.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM ${identificador(tabla)}), false)`, [tabla]);
  };
  await guardar('titulados', planificar(comparacion.titulados, modo), insertarTitulado);
  await guardar('empleadores', planificar(comparacion.empleadores, modo), insertarEmpleador);

  // Textos de las afirmaciones: agregar solo completa los que falten
  for (const item of p.datos.items) {
    await db.query(
      `INSERT INTO items_empleadores (codigo, afirmacion, origen) VALUES ($1, $2, 'base_oficial')
       ON CONFLICT (codigo) DO ${modo === 'agregar' ? 'NOTHING' : 'UPDATE SET afirmacion = EXCLUDED.afirmacion'}`,
      [item.codigo, item.afirmacion]
    );
  }

  const t = totales(comparacion, modo);
  await db.query('UPDATE importaciones SET insertados = $2, actualizados = $3, omitidos = $4, eliminados = $5 WHERE id = $1', [
    importacionId,
    t.insertados,
    t.actualizados,
    t.omitidos,
    t.eliminados
  ]);
  return { id: importacionId, archivo: p.archivo, modo, created_at: rows[0].created_at.toISOString(), ...t };
}
