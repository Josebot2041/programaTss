/**
 * Tabla de rutas de la API. Express la recorre en server/app.ts; en Vercel, cada archivo
 * api/<ruta>.ts puede exportar `(req, res) => despachar(RUTAS['/api/<ruta>'], req.method, req)`.
 *
 * Cada ruta declara su acceso: 'publico', 'sesion' (requiereSesion) o 'admin'
 * (requiereSesion + requiereAdmin).
 */

import { actualizarUsuario, eliminarUsuario, listarUsuarios, resumen } from './admin';
import { login, logout, registro, yo } from './auth';
import { crearEmpleador, listarEmpleadores, listarItemsEmpleadores } from './empleadores';
import { health } from './health';
import { crearTitulado, listarTitulados } from './titulados';
import type { ManejadoresRuta } from './tipos';

export const RUTAS: Record<string, ManejadoresRuta> = {
  '/api/health': { acceso: 'publico', GET: health },
  '/api/auth/registro': { acceso: 'publico', POST: registro },
  '/api/auth/login': { acceso: 'publico', POST: login },
  '/api/auth/logout': { acceso: 'publico', POST: logout },
  '/api/auth/yo': { acceso: 'sesion', GET: yo },
  '/api/titulados': { acceso: 'sesion', GET: listarTitulados, POST: crearTitulado },
  '/api/empleadores': { acceso: 'sesion', GET: listarEmpleadores, POST: crearEmpleador },
  '/api/items-empleadores': { acceso: 'sesion', GET: listarItemsEmpleadores },
  '/api/admin/usuarios': { acceso: 'admin', GET: listarUsuarios },
  '/api/admin/usuarios/:id': { acceso: 'admin', PATCH: actualizarUsuario, DELETE: eliminarUsuario },
  '/api/admin/resumen': { acceso: 'admin', GET: resumen }
};

export { despachar } from './tipos';
export type { Acceso, Manejador, Peticion, Respuesta } from './tipos';
