/**
 * Conversión entre las filas de PostgreSQL y el modelo de la aplicación (Titulado, Empleador).
 *
 * Los nombres de columna salen de la especificación del importador, de modo que la base,
 * el Excel y los tipos usan exactamente los mismos campos.
 */

import { CODIGOS_ITEMS, segmentoDe } from '../src/data/catalogos';
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

/** Columnas de datos (sin id, origen ni created_at). */
export const CAMPOS_TITULADO = COLUMNAS_TITULADOS.map((c) => identificador(c.nombre)).filter((n) => n !== 'id');
export const CAMPOS_EMPLEADOR = COLUMNAS_EMPLEADORES.map((c) => identificador(c.nombre)).filter((n) => n !== 'id');

/** INSERT parametrizado de una encuesta; devuelve la fila guardada. */
export function sqlInsertar(tabla: Tabla, campos: string[]): string {
  const parametros = campos.map((_, i) => `$${i + 1}`);
  return `INSERT INTO ${identificador(tabla)} (${campos.map(identificador).join(', ')}, origen)
    VALUES (${parametros.join(', ')}, $${campos.length + 1}) RETURNING *`;
}

const CODIGOS = new Set(CODIGOS_ITEMS);

export function valoresTitulado(t: Omit<Titulado, 'id'>): unknown[] {
  const registro = t as unknown as Record<string, unknown>;
  return CAMPOS_TITULADO.map((c) => registro[c] ?? null);
}

export function valoresEmpleador(e: Omit<Empleador, 'id'>): unknown[] {
  const registro = e as unknown as Record<string, unknown>;
  return CAMPOS_EMPLEADOR.map((c) => (CODIGOS.has(c) ? e.items_likert[c] : registro[c]) ?? null);
}

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
