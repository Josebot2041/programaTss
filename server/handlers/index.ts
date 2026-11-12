/**
 * Tabla de rutas de la API. Express la recorre en server/app.ts, que aplica el acceso de cada
 * ruta: 'publico', 'sesion' (requiereSesion) o 'admin' (requiereSesion + requiereAdmin).
 *
 * despachar() no comprueba el acceso: fuera de crearApp() (por ejemplo, en una función de Vercel)
 * hay que aplicar antes requiereSesion / requiereAdmin. Ver «Despliegue futuro en Vercel» en el README.
 */

import { actualizarUsuario, eliminarUsuario, listarUsuarios, resumen } from './admin';
import { login, logout, yo } from './auth';
import { crearEmpleador, listarEmpleadores, listarItemsEmpleadores } from './empleadores';
import { health } from './health';
import { confirmarImportacion, listarImportaciones, previsualizarImportacion } from './importacion';
import { crearEmpleadorPublico, crearTituladoPublico } from './publico';
import { crearTitulado, listarTitulados } from './titulados';
import type { ManejadoresRuta } from './tipos';

export const RUTAS: Record<string, ManejadoresRuta> = {
  '/api/health': { acceso: 'publico', GET: health },
  // Encuestas de la portada pública: sin cuenta, con límite por IP y campo trampa
  '/api/publico/titulados': { acceso: 'publico', POST: crearTituladoPublico },
  '/api/publico/empleadores': { acceso: 'publico', POST: crearEmpleadorPublico },
  '/api/auth/login': { acceso: 'publico', POST: login },
  '/api/auth/logout': { acceso: 'publico', POST: logout },
  '/api/auth/yo': { acceso: 'sesion', GET: yo },
  // Los datos son del panel de análisis, que solo usan los administradores
  '/api/titulados': { acceso: 'admin', GET: listarTitulados, POST: crearTitulado },
  '/api/empleadores': { acceso: 'admin', GET: listarEmpleadores, POST: crearEmpleador },
  '/api/items-empleadores': { acceso: 'admin', GET: listarItemsEmpleadores },
  '/api/admin/usuarios': { acceso: 'admin', GET: listarUsuarios },
  '/api/admin/usuarios/:id': { acceso: 'admin', PATCH: actualizarUsuario, DELETE: eliminarUsuario },
  '/api/admin/resumen': { acceso: 'admin', GET: resumen },
  // Importación de archivos al panel: previsualizar (multipart, ver server/app.ts) y confirmar
  '/api/admin/importar/previsualizar': { acceso: 'admin', POST: previsualizarImportacion },
  '/api/admin/importar/confirmar': { acceso: 'admin', POST: confirmarImportacion },
  '/api/admin/importaciones': { acceso: 'admin', GET: listarImportaciones }
};

export { despachar } from './tipos';
export type { Acceso, Manejador, Peticion, Respuesta } from './tipos';
