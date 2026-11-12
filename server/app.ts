/**
 * Aplicación Express de la API (/api/*). Solo adapta los manejadores de server/handlers,
 * que no dependen de Express (se pueden reutilizar como funciones serverless de Vercel).
 * Aquí se agregan lo propio de HTTP: sesión, control de acceso, límites de intentos y la subida
 * de archivos para importar.
 */

import express from 'express';
import multer from 'multer';
import { RUTAS, type Acceso, type Manejador } from './handlers';
import type { Metodo } from './handlers/tipos';
import {
  cerrarSesion,
  crearLimiteEncuestas,
  crearLimiteLogin,
  crearMiddlewareSesion,
  enProduccion,
  iniciarSesion,
  requiereAdmin,
  requiereSesion
} from './sesion';

/** Primer valor de cada parámetro de la URL (?a=1&a=2 → a: '1'). */
function parametros(query: express.Request['query']): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const [clave, valor] of Object.entries(query)) {
    const primero = Array.isArray(valor) ? valor[0] : valor;
    if (typeof primero === 'string') resultado[clave] = primero;
  }
  return resultado;
}

/** Convierte un manejador independiente en un middleware de Express. */
function adaptar(manejador: Manejador): express.RequestHandler {
  return async (req, res) => {
    const { status, body, sesion } = await manejador({
      body: req.body,
      params: req.params as Record<string, string>,
      query: parametros(req.query),
      usuario: res.locals.usuario,
      archivo: req.file ? { nombre: req.file.originalname, datos: req.file.buffer } : undefined
    });
    if (sesion === 'cerrar') await cerrarSesion(req, res);
    else if (sesion) await iniciarSesion(req, sesion.usuarioId);
    res.status(status).json(body);
  };
}

const CONTROL_ACCESO: Record<Acceso, express.RequestHandler[]> = {
  publico: [],
  sesion: [requiereSesion],
  admin: [requiereSesion, requiereAdmin]
};

const METODOS: Record<Metodo, 'get' | 'post' | 'patch' | 'delete'> = { GET: 'get', POST: 'post', PATCH: 'patch', DELETE: 'delete' };

export const MAX_ARCHIVO_IMPORTACION = 10 * 1024 * 1024;

/** Error de la subida que se informa al cliente con su estado. */
class ErrorSubida extends Error {
  constructor(
    readonly status: number,
    mensaje: string
  ) {
    super(mensaje);
  }
}

/**
 * Archivo de una importación (multipart, campo «archivo»): hasta 10 MB, solo .xlsx o .csv, en
 * memoria (no se escribe en disco). Va después del control de acceso: solo un administrador
 * puede subir archivos. Es la única ruta con un límite mayor a los 100 KB del JSON.
 */
const recibirArchivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ARCHIVO_IMPORTACION, files: 1, fields: 5 },
  defParamCharset: 'utf8', // nombres de archivo con tildes
  fileFilter: (_req, archivo, aceptar) => {
    if (/\.(xlsx|csv)$/i.test(archivo.originalname)) aceptar(null, true);
    else aceptar(new ErrorSubida(400, 'Solo se aceptan archivos .xlsx o .csv.'));
  }
}).single('archivo');

/** Middlewares propios de una ruta, después del control de acceso. */
const PREVIOS: Record<string, express.RequestHandler[]> = {
  '/api/admin/importar/previsualizar': [recibirArchivo]
};

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  // En producción la app corre detrás de un proxy HTTPS: req.ip y la cookie Secure dependen de esto.
  if (enProduccion()) app.set('trust proxy', 1);
  // Una encuesta ocupa pocos KB; se rechazan cuerpos más grandes.
  app.use(express.json({ limit: '100kb' }));
  // Los datos cambian con cada encuesta: ninguna respuesta GET se guarda en caché (navegador ni proxy).
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET') res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', crearMiddlewareSesion());
  app.post('/api/auth/login', crearLimiteLogin());
  app.post('/api/publico/titulados', crearLimiteEncuestas());
  app.post('/api/publico/empleadores', crearLimiteEncuestas());

  for (const [ruta, { acceso, ...manejadores }] of Object.entries(RUTAS)) {
    for (const [metodo, manejador] of Object.entries(manejadores) as Array<[Metodo, Manejador]>) {
      app[METODOS[metodo]](ruta, ...CONTROL_ACCESO[acceso], ...(PREVIOS[ruta] ?? []), adaptar(manejador));
    }
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  // Errores no controlados (base caída, JSON mal formado…): sin detalles internos al cliente.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ErrorSubida) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (err instanceof multer.MulterError) {
      const mensaje = err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el máximo de 10 MB.' : `No se pudo recibir el archivo (${err.code}).`;
      res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: mensaje });
      return;
    }
    const estado = (err as { status?: number }).status;
    if (estado === 400) {
      res.status(400).json({ errores: { cuerpo: 'JSON mal formado' } });
      return;
    }
    if (estado === 413) {
      res.status(413).json({ errores: { cuerpo: 'La petición es demasiado grande' } });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}
