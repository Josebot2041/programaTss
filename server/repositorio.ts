/**
 * Acceso a la base normalizada (db/schema.sql, diagrama en docs/modelo_er.md).
 *
 * - Escritura: un Titulado o Empleador de la aplicación se reparte entre su tabla, las tablas
 *   intermedias de selección múltiple y respuestas_empleador; los textos de catálogo se
 *   guardan como ids.
 * - Lectura: las vistas v_titulados y v_empleadores devuelven el formato plano, con los mismos
 *   nombres de columna que el importador, y tituladoDeFila / empleadorDeFila lo convierten al modelo.
 */

import type pg from 'pg';
import {
  ACTIVIDADES,
  AREAS_POSGRADO,
  ASIGNATURAS_NO_UTILES,
  ASIGNATURAS_VENTAJA,
  ASPECTOS_MEJORAR,
  ASPECTOS_UTILES,
  CARGOS_EMPLEADOR,
  CARGOS_TITULADO,
  CODIGOS_ITEMS,
  FINANCIAMIENTOS,
  FINANCIAMIENTOS_NEGOCIO,
  INSTITUCIONES_PREFERIDAS,
  LUGARES_POSGRADO,
  NIVELES_POSGRADO,
  RUBROS_EMPLEADOR,
  RUBROS_TITULADO,
  SECTORES,
  TIPOS_ORGANIZACION,
  segmentoDe
} from '../src/data/catalogos';
import type { Empleador, ItemEmpleador, Titulado } from '../src/types';
import { COLUMNAS_EMPLEADORES, COLUMNAS_TITULADOS } from '../src/utils/importador';

export type Origen = 'base_oficial' | 'formulario';
export type Tabla = 'titulados' | 'empleadores';

/**
 * Los valores siempre viajan como parámetros ($1, $2, …). Los nombres de tabla y de columna
 * no pueden ser parámetros en SQL: salen de constantes del código y además se exige que sean
 * identificadores simples, de modo que nunca pueda colarse texto arbitrario en una consulta.
 */
export function identificador(nombre: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(nombre)) throw new Error(`Identificador SQL no válido: ${nombre}`);
  return nombre;
}

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------

const unir = (...listas: (readonly string[])[]): string[] => [...new Set(listas.flat())];

/**
 * Valores de cada tabla de catálogo, en el orden de src/data/catalogos.ts. Cuando dos
 * preguntas comparten tabla (p. ej. rubros de titulados y de empleadores) se cargan ambas
 * listas; qué subconjunto acepta cada pregunta lo valida src/utils/validacion.ts.
 */
export const CATALOGOS = {
  areas_posgrado: [...AREAS_POSGRADO],
  instituciones: unir(INSTITUCIONES_PREFERIDAS, LUGARES_POSGRADO),
  niveles_posgrado: [...NIVELES_POSGRADO],
  fuentes_financiamiento: unir(FINANCIAMIENTOS, FINANCIAMIENTOS_NEGOCIO),
  rubros: unir(RUBROS_TITULADO, RUBROS_EMPLEADOR),
  sectores: unir(SECTORES, TIPOS_ORGANIZACION),
  cargos_titulado: [...CARGOS_TITULADO],
  cargos_empleador: [...CARGOS_EMPLEADOR],
  asignaturas: unir(ASIGNATURAS_VENTAJA, ASIGNATURAS_NO_UTILES),
  aspectos_carrera: unir(ASPECTOS_UTILES, ASPECTOS_MEJORAR),
  actividades: [...ACTIVIDADES]
} satisfies Record<string, string[]>;

export type TablaCatalogo = keyof typeof CATALOGOS;

/** Códigos de escala_likert_empleador, en el orden de LIKERT_EMPLEADOR. */
export const CODIGOS_LIKERT_EMPLEADOR = ['TA', 'PA', 'TD', 'NS'] as const;

/** Ids de la base: tabla → texto → id (para items_empleadores, código → id). */
export type Ids = Map<string, Map<string, number>>;

/** Lee los ids de todos los catálogos y afirmaciones en una sola consulta. */
export async function leerIds(db: pg.ClientBase): Promise<Ids> {
  const consultas = [...Object.keys(CATALOGOS), 'escala_likert_empleador'].map(
    (t) => `SELECT '${identificador(t)}' AS tabla, id, nombre FROM ${identificador(t)}`
  );
  consultas.push(`SELECT 'items_empleadores', id, codigo FROM items_empleadores`);
  const { rows } = await db.query<{ tabla: string; id: number; nombre: string }>(consultas.join(' UNION ALL '));
  const ids: Ids = new Map();
  for (const { tabla, id, nombre } of rows) {
    if (!ids.has(tabla)) ids.set(tabla, new Map());
    ids.get(tabla)!.set(nombre, id);
  }
  return ids;
}

function idDe(ids: Ids, tabla: string, valor: string): number {
  const id = ids.get(tabla)?.get(valor);
  if (id === undefined) throw new Error(`«${valor}» no está en ${tabla} (ejecute npm run db:seed)`);
  return id;
}

// ---------------------------------------------------------------------------
// Columnas de cada tabla
// ---------------------------------------------------------------------------

/** Pregunta de respuesta única: su columna y, si apunta a un catálogo, cuál. */
interface ColumnaSimple {
  campo: string;
  columna: string;
  catalogo?: TablaCatalogo;
}

/** Pregunta de selección múltiple: tabla intermedia, columna y catálogo de sus opciones. */
interface ColumnaLista {
  campo: string;
  tabla: string;
  columna: string;
  catalogo: TablaCatalogo;
}

const texto = (campo: string): ColumnaSimple => ({ campo, columna: campo });
const fk = (campo: string, catalogo: TablaCatalogo): ColumnaSimple => ({ campo, columna: `${campo}_id`, catalogo });
/** En escala_likert_titulado el id es el propio valor (1 a 4): se guarda tal cual. */
const likert = (campo: string): ColumnaSimple => ({ campo, columna: `${campo}_id` });

const COLUMNAS_TITULADO: ColumnaSimple[] = [
  texto('edad'),
  texto('genero'),
  texto('formacion_complementaria'),
  fk('nivel_realizado', 'niveles_posgrado'),
  fk('lugar_realizado', 'instituciones'),
  fk('financiamiento', 'fuentes_financiamiento'),
  texto('programa'),
  texto('interes_posgrado'),
  fk('area_interes', 'areas_posgrado'),
  fk('institucion_preferida', 'instituciones'),
  likert('opinion_posgrado_fcyt'),
  texto('anios_vida_profesional'),
  texto('anios_desempleado'),
  texto('situacion_laboral'),
  texto('empresa'),
  fk('rubro', 'rubros'),
  fk('sector', 'sectores'),
  texto('departamento'),
  fk('cargo', 'cargos_titulado'),
  likert('pertinencia_labores'),
  texto('antiguedad_trabajo'),
  texto('medio_obtencion'),
  texto('remuneracion'),
  texto('origen_emprendimiento'),
  texto('entregable_negocio'),
  fk('financiamiento_negocio', 'fuentes_financiamiento'),
  texto('satisfaccion_negocio'),
  texto('importancia_formacion_negocio'),
  texto('primer_empleo'),
  texto('razon_no_trabaja'),
  texto('trabajo_previo_sistemas'),
  texto('tiempo_primer_empleo'),
  texto('numero_empleos'),
  likert('satisfaccion_global'),
  likert('concordancia_formacion'),
  texto('red_contactos')
];

const LISTAS_TITULADO: ColumnaLista[] = [
  { campo: 'actividades', tabla: 'titulado_actividad', columna: 'actividad_id', catalogo: 'actividades' },
  { campo: 'aspectos_utiles', tabla: 'titulado_aspecto_util', columna: 'aspecto_id', catalogo: 'aspectos_carrera' },
  { campo: 'aspectos_mejorar', tabla: 'titulado_aspecto_mejorar', columna: 'aspecto_id', catalogo: 'aspectos_carrera' },
  { campo: 'asignaturas_ventaja', tabla: 'titulado_asignatura_ventaja', columna: 'asignatura_id', catalogo: 'asignaturas' },
  { campo: 'asignaturas_no_utiles', tabla: 'titulado_asignatura_no_util', columna: 'asignatura_id', catalogo: 'asignaturas' }
];

const COLUMNAS_EMPLEADOR: ColumnaSimple[] = [
  texto('organizacion'),
  fk('tipo', 'sectores'),
  texto('tamano'),
  fk('rubro', 'rubros'),
  texto('contrato_5_anios'),
  texto('posibilidad_contratacion'),
  texto('nivel_demandado'),
  texto('medio_convocatoria'),
  texto('tendencias'),
  texto('habilidades')
];

const LISTAS_EMPLEADOR: ColumnaLista[] = [
  { campo: 'cargos', tabla: 'empleador_cargo', columna: 'cargo_id', catalogo: 'cargos_empleador' }
];

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

export interface DatosInsercion {
  origen: Origen;
  /** Id a conservar (base oficial o migración); sin él lo asigna la base. */
  id?: number;
  /** Fecha de creación a conservar al recargar un registro. */
  creado?: Date;
}

type Registro = Record<string, unknown>;

async function insertarFila(db: pg.ClientBase, tabla: Tabla, ids: Ids, r: Registro, columnas: ColumnaSimple[], datos: DatosInsercion): Promise<number> {
  const nombres = columnas.map((c) => c.columna);
  const valores = columnas.map(({ campo, catalogo }) => {
    const v = r[campo];
    if (v === undefined || v === null) return null;
    return catalogo ? idDe(ids, catalogo, String(v)) : v;
  });
  nombres.push('origen');
  valores.push(datos.origen);
  if (datos.id !== undefined) {
    nombres.push('id');
    valores.push(datos.id);
  }
  if (datos.creado) {
    nombres.push('created_at');
    valores.push(datos.creado);
  }
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO ${identificador(tabla)} (${nombres.map(identificador).join(', ')})
     VALUES (${valores.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    valores
  );
  return rows[0].id;
}

/** Una fila por opción elegida; "orden" guarda la posición (1, 2, 3…) en la respuesta. */
async function insertarListas(db: pg.ClientBase, columnaPadre: string, idPadre: number, ids: Ids, r: Registro, listas: ColumnaLista[]) {
  for (const l of listas) {
    const elegidos = (r[l.campo] as string[] | undefined) ?? [];
    if (elegidos.length === 0) continue;
    await db.query(
      `INSERT INTO ${identificador(l.tabla)} (${identificador(columnaPadre)}, ${identificador(l.columna)}, orden)
       SELECT $1, x.id, x.orden FROM unnest($2::smallint[]) WITH ORDINALITY AS x(id, orden)`,
      [idPadre, elegidos.map((v) => idDe(ids, l.catalogo, v))]
    );
  }
}

/** Guarda un titulado con sus selecciones múltiples. Debe llamarse dentro de una transacción. */
export async function insertarTitulado(db: pg.ClientBase, ids: Ids, t: Omit<Titulado, 'id'>, datos: DatosInsercion): Promise<number> {
  const r = t as unknown as Registro;
  const id = await insertarFila(db, 'titulados', ids, r, COLUMNAS_TITULADO, datos);
  await insertarListas(db, 'titulado_id', id, ids, r, LISTAS_TITULADO);
  return id;
}

/** Guarda un empleador con sus cargos y respuestas. Debe llamarse dentro de una transacción. */
export async function insertarEmpleador(db: pg.ClientBase, ids: Ids, e: Omit<Empleador, 'id'>, datos: DatosInsercion): Promise<number> {
  const r = e as unknown as Registro;
  const id = await insertarFila(db, 'empleadores', ids, r, COLUMNAS_EMPLEADOR, datos);
  await insertarListas(db, 'empleador_id', id, ids, r, LISTAS_EMPLEADOR);

  const respuestas = Object.entries(e.items_likert).filter((par): par is [string, NonNullable<(typeof par)[1]>] => par[1] !== undefined);
  if (respuestas.length > 0) {
    await db.query(
      `INSERT INTO respuestas_empleador (empleador_id, item_id, valor_id)
       SELECT $1, item_id, valor_id FROM unnest($2::integer[], $3::smallint[]) AS x(item_id, valor_id)`,
      [
        id,
        respuestas.map(([codigo]) => idDe(ids, 'items_empleadores', codigo)),
        respuestas.map(([, valor]) => idDe(ids, 'escala_likert_empleador', valor))
      ]
    );
  }
  return id;
}

// ---------------------------------------------------------------------------
// Lectura (filas de v_titulados / v_empleadores)
// ---------------------------------------------------------------------------

/** Columnas de datos de las vistas (sin id, origen ni created_at): las del importador. */
export const CAMPOS_TITULADO = COLUMNAS_TITULADOS.map((c) => c.nombre).filter((n) => n !== 'id');
export const CAMPOS_EMPLEADOR = COLUMNAS_EMPLEADORES.map((c) => c.nombre).filter((n) => n !== 'id');

const CODIGOS = new Set(CODIGOS_ITEMS);

type Fila = Record<string, unknown>;

/** Copia las columnas no nulas (NULL = sin respuesta, se omite el campo). */
function copiarNoNulos(fila: Fila, campos: string[], destino: Record<string, unknown>) {
  for (const c of campos) if (fila[c] !== null && fila[c] !== undefined) destino[c] = fila[c];
}

export function tituladoDeFila(fila: Fila): Titulado {
  const t: Record<string, unknown> = { id: String(fila.id) };
  copiarNoNulos(fila, CAMPOS_TITULADO, t);
  const titulado = t as unknown as Titulado;
  titulado.segmento = segmentoDe(titulado.anios_vida_profesional);
  return titulado;
}

export function empleadorDeFila(fila: Fila): Empleador {
  const e: Record<string, unknown> = { id: String(fila.id) };
  copiarNoNulos(fila, CAMPOS_EMPLEADOR.filter((c) => !CODIGOS.has(c)), e);
  const items_likert: Record<string, unknown> = {};
  copiarNoNulos(fila, CODIGOS_ITEMS, items_likert);
  return { ...(e as unknown as Omit<Empleador, 'items_likert'>), items_likert: items_likert as Empleador['items_likert'] };
}

export function itemDeFila(fila: Fila): ItemEmpleador {
  return { codigo: String(fila.codigo), afirmacion: String(fila.afirmacion) };
}
