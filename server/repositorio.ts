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

/** Columnas de datos (sin id, origen ni created_at). */
export const CAMPOS_TITULADO = COLUMNAS_TITULADOS.map((c) => c.nombre).filter((n) => n !== 'id');
export const CAMPOS_EMPLEADOR = COLUMNAS_EMPLEADORES.map((c) => c.nombre).filter((n) => n !== 'id');

const CODIGOS = new Set(CODIGOS_ITEMS);

export function valoresTitulado(t: Titulado): unknown[] {
  const registro = t as unknown as Record<string, unknown>;
  return CAMPOS_TITULADO.map((c) => registro[c] ?? null);
}

export function valoresEmpleador(e: Empleador): unknown[] {
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
