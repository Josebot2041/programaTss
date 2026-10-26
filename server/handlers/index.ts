/**
 * Tabla de rutas de la API. Express la recorre en server/app.ts; en Vercel, cada archivo
 * api/<ruta>.ts puede exportar `(req, res) => despachar(RUTAS['/api/<ruta>'], req.method, req)`.
 */

import { crearEmpleador, listarEmpleadores, listarItemsEmpleadores } from './empleadores';
import { health } from './health';
import { crearTitulado, listarTitulados } from './titulados';
import type { ManejadoresRuta } from './tipos';

export const RUTAS: Record<string, ManejadoresRuta> = {
  '/api/health': { GET: health },
  '/api/titulados': { GET: listarTitulados, POST: crearTitulado },
  '/api/empleadores': { GET: listarEmpleadores, POST: crearEmpleador },
  '/api/items-empleadores': { GET: listarItemsEmpleadores }
};

export { despachar } from './tipos';
export type { Manejador, Peticion, Respuesta } from './tipos';
