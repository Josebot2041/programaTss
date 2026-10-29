/**
 * Contrato de los manejadores de la API. No dependen de Express: reciben lo mínimo de la
 * petición y devuelven estado + cuerpo JSON, así sirven igual para Express o para funciones
 * serverless de Vercel (api/*.ts).
 */

import type { Usuario } from '../../src/utils/validacionUsuario';

export interface Peticion {
  /** Cuerpo JSON ya interpretado (undefined en GET). */
  body?: unknown;
  /** Parámetros de la ruta, p. ej. { id: '7' } en /api/admin/usuarios/:id. */
  params?: Record<string, string>;
  /** Parámetros de la URL (?buscar=…&pagina=…), con el primer valor de cada uno. */
  query?: Record<string, string>;
  /** Usuario con sesión; lo completa requiereSesion en las rutas protegidas. */
  usuario?: Usuario;
}

/**
 * Cambio de sesión que el adaptador aplica antes de responder: iniciarla (login y registro)
 * o cerrarla (logout). Los manejadores no manejan cookies.
 */
export type CambioSesion = { usuarioId: number } | 'cerrar';

export interface Respuesta {
  status: number;
  body: unknown;
  sesion?: CambioSesion;
}

export type Manejador = (peticion: Peticion) => Promise<Respuesta>;

export type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Quién puede usar una ruta: cualquiera, un usuario con sesión o solo un administrador. */
export type Acceso = 'publico' | 'sesion' | 'admin';

/** Manejadores de una ruta, por método HTTP, y su nivel de acceso. */
export type ManejadoresRuta = Partial<Record<Metodo, Manejador>> & { acceso: Acceso };

/**
 * Elige el manejador según el método (útil en Vercel, donde un archivo atiende todos los métodos).
 * No comprueba el acceso: quien lo use debe aplicar antes el equivalente de requiereSesion /
 * requiereAdmin (ver server/sesion.ts).
 */
export function despachar(ruta: ManejadoresRuta, metodo: string | undefined, peticion: Peticion): Promise<Respuesta> {
  const manejador = ruta[(metodo ?? 'GET').toUpperCase() as Metodo];
  return manejador ? manejador(peticion) : Promise.resolve({ status: 405, body: { error: 'Método no permitido' } });
}
