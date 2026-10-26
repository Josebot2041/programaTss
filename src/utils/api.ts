/**
 * Cliente de la API del backend (/api/*, ver server/).
 * Si la API no responde, la aplicación usa el Excel local como respaldo (ver App.tsx).
 */

import type { Empleador, ItemEmpleador, Titulado } from '../types';
import type { BorradorEmpleador, BorradorTitulado, Errores } from './validacion';

/** Tiempo máximo de espera antes de considerar que la API no responde. */
const ESPERA_MS = 5000;

export interface DatosApi {
  titulados: Titulado[];
  empleadores: Empleador[];
  items: ItemEmpleador[];
}

export type ResultadoGuardado<T> = { ok: true; registro: T } | { ok: false; errores: Errores; mensaje?: string };

async function obtener<T>(ruta: string): Promise<T> {
  const respuesta = await fetch(`/api/${ruta}`, { signal: AbortSignal.timeout(ESPERA_MS) });
  if (!respuesta.ok) throw new Error(`GET /api/${ruta} respondió HTTP ${respuesta.status}`);
  return (await respuesta.json()) as T;
}

/** Carga titulados, empleadores y afirmaciones desde la base de datos. */
export async function cargarDesdeApi(): Promise<DatosApi> {
  const [titulados, empleadores, items] = await Promise.all([
    obtener<Titulado[]>('titulados'),
    obtener<Empleador[]>('empleadores'),
    obtener<ItemEmpleador[]>('items-empleadores')
  ]);
  return { titulados, empleadores, items };
}

async function enviar<T>(ruta: string, borrador: unknown): Promise<ResultadoGuardado<T>> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api/${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(borrador),
      signal: AbortSignal.timeout(ESPERA_MS)
    });
  } catch {
    return { ok: false, errores: {}, mensaje: 'No se pudo conectar con el servidor; la encuesta no se guardó.' };
  }
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (respuesta.ok) return { ok: true, registro: cuerpo as T };
  if (respuesta.status === 400) return { ok: false, errores: (cuerpo as { errores?: Errores }).errores ?? {} };
  return { ok: false, errores: {}, mensaje: `El servidor no pudo guardar la encuesta (HTTP ${respuesta.status}).` };
}

export const guardarTitulado = (b: BorradorTitulado) => enviar<Titulado>('titulados', b);
export const guardarEmpleador = (b: BorradorEmpleador) => enviar<Empleador>('empleadores', b);
