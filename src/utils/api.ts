/**
 * Cliente de la API del backend (/api/*, ver server/).
 * En el panel, si la API no responde o falla (5xx), se usa el Excel local como respaldo y se indica
 * en el Header (ver Panel.tsx). Un 401 nunca lleva al Excel: vuelve al login de administrador.
 * La sesión viaja en una cookie httpOnly que el navegador envía solo (mismo origen).
 */

import type { Empleador, ItemEmpleador, Titulado } from '../types';
import type { Rol } from '../data/catalogos';
import { CAMPO_TRAMPA, type BorradorEmpleador, type BorradorTitulado, type Errores } from './validacion';
import type { Usuario } from './validacionUsuario';

/** Tiempo máximo de espera antes de considerar que la API no responde. */
const ESPERA_MS = 5000;

export interface DatosApi {
  titulados: Titulado[];
  empleadores: Empleador[];
  items: ItemEmpleador[];
}

export type ResultadoGuardado<T> = { ok: true; registro: T } | { ok: false; errores: Errores; mensaje?: string };

/** Error de una respuesta HTTP no exitosa; `estado` 0 significa que no hubo conexión. */
export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
    readonly errores: Errores = {}
  ) {
    super(mensaje);
  }
}

/** true si el error es de conexión o del servidor (5xx): solo entonces se usa el Excel de respaldo. */
export function esFallaDelServidor(err: unknown): boolean {
  return err instanceof ErrorApi && (err.estado === 0 || err.estado >= 500);
}

// La aplicación se suscribe para volver al login cuando la sesión vence o se cierra en otro lado.
let alPerderSesion: (() => void) | undefined;
export function avisarAlPerderSesion(fn: (() => void) | undefined) {
  alPerderSesion = fn;
}

/** Petición JSON a /api/<ruta>. Lanza ErrorApi si no hay conexión o la respuesta no es 2xx. */
async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api/${ruta}`, {
      method: metodo,
      headers: cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      credentials: 'same-origin',
      // Siempre datos frescos de la base, nunca una copia guardada por el navegador
      cache: 'no-store',
      signal: AbortSignal.timeout(ESPERA_MS)
    });
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor.');
  }
  const datos = (await respuesta.json().catch(() => undefined)) as { error?: string; errores?: Errores } | undefined;
  if (respuesta.ok) {
    // Un 2xx que no es JSON (p. ej. index.html de un servidor estático) significa que no hay API detrás
    if (datos === undefined) throw new ErrorApi(0, 'El servidor no respondió como la API.');
    return datos as T;
  }
  // 401 en una ruta protegida: la sesión ya no es válida (el login responde 401 por otra razón)
  if (respuesta.status === 401 && ruta !== 'auth/login' && ruta !== 'auth/yo') alPerderSesion?.();
  throw new ErrorApi(respuesta.status, datos?.error ?? `El servidor respondió HTTP ${respuesta.status}.`, datos?.errores);
}

/** Carga titulados, empleadores y afirmaciones desde la base de datos. */
export async function cargarDesdeApi(): Promise<DatosApi> {
  const [titulados, empleadores, items] = await Promise.all([
    pedir<Titulado[]>('GET', 'titulados'),
    pedir<Empleador[]>('GET', 'empleadores'),
    pedir<ItemEmpleador[]>('GET', 'items-empleadores')
  ]);
  return { titulados, empleadores, items };
}

async function enviar<T>(ruta: string, borrador: unknown): Promise<ResultadoGuardado<T>> {
  try {
    return { ok: true, registro: await pedir<T>('POST', ruta, borrador) };
  } catch (err) {
    const e = err as ErrorApi;
    if (e.estado === 0) return { ok: false, errores: {}, mensaje: 'No se pudo conectar con el servidor; la encuesta no se envió. Intente de nuevo.' };
    if (e.estado === 400) return { ok: false, errores: e.errores };
    if (e.estado === 429) return { ok: false, errores: {}, mensaje: e.message };
    return { ok: false, errores: {}, mensaje: `El servidor no pudo guardar la encuesta (HTTP ${e.estado}). Intente de nuevo en unos minutos.` };
  }
}

/**
 * Encuestas de la portada pública (sin cuenta). `trampa` es el valor del campo oculto contra bots:
 * una persona lo deja vacío.
 */
export const enviarTituladoPublico = (b: BorradorTitulado, trampa = '') =>
  enviar<Titulado>('publico/titulados', { ...b, [CAMPO_TRAMPA]: trampa });
export const enviarEmpleadorPublico = (b: BorradorEmpleador, trampa = '') =>
  enviar<Empleador>('publico/empleadores', { ...b, [CAMPO_TRAMPA]: trampa });

// ---------------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------------

/** Usuario con sesión, null si no hay sesión. Lanza ErrorApi si el servidor no responde. */
export async function obtenerSesion(): Promise<Usuario | null> {
  try {
    return await pedir<Usuario>('GET', 'auth/yo');
  } catch (err) {
    if (err instanceof ErrorApi && err.estado === 401) return null;
    throw err;
  }
}

export const iniciarSesion = (ci: string, password: string) => pedir<Usuario>('POST', 'auth/login', { ci, password });

export const cerrarSesion = () => pedir<{ ok: true }>('POST', 'auth/logout');

// ---------------------------------------------------------------------------
// Administración
// ---------------------------------------------------------------------------

export interface ConteoOrigen {
  total: number;
  base_oficial: number;
  formulario: number;
}

export interface RegistrosDia {
  /** AAAA-MM-DD, hora de Bolivia. */
  fecha: string;
  titulados: number;
  empleadores: number;
  usuarios: number;
}

export interface ResumenAdmin {
  usuarios: { total: number; admins: number; activos: number };
  titulados: ConteoOrigen;
  empleadores: ConteoOrigen;
  ultimos_7_dias: { titulados: number; empleadores: number; usuarios: number; por_dia: RegistrosDia[] };
}

export interface PaginaUsuarios {
  usuarios: Usuario[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export const obtenerResumen = () => pedir<ResumenAdmin>('GET', 'admin/resumen');

export function listarUsuarios(buscar: string, pagina: number, porPagina = 20) {
  const parametros = new URLSearchParams({ buscar, pagina: String(pagina), por_pagina: String(porPagina) });
  return pedir<PaginaUsuarios>('GET', `admin/usuarios?${parametros}`);
}

export const actualizarUsuario = (id: number, cambios: { activo?: boolean; rol?: Rol }) =>
  pedir<Usuario>('PATCH', `admin/usuarios/${id}`, cambios);

export const eliminarUsuario = (id: number) => pedir<{ ok: true; id: number }>('DELETE', `admin/usuarios/${id}`);
