/**
 * Aplicación Express de la API (/api/*). Solo adapta los manejadores de server/handlers,
 * que no dependen de Express (se pueden reutilizar como funciones serverless de Vercel).
 */

import express from 'express';
import { RUTAS, type Manejador } from './handlers';

/** Convierte un manejador independiente en un middleware de Express. */
function adaptar(manejador: Manejador): express.RequestHandler {
  return async (req, res) => {
    const { status, body } = await manejador({ body: req.body });
    res.status(status).json(body);
  };
}

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  // Una encuesta ocupa pocos KB; se rechazan cuerpos más grandes.
  app.use(express.json({ limit: '100kb' }));

  for (const [ruta, manejadores] of Object.entries(RUTAS)) {
    if (manejadores.GET) app.get(ruta, adaptar(manejadores.GET));
    if (manejadores.POST) app.post(ruta, adaptar(manejadores.POST));
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  // Errores no controlados (base caída, JSON mal formado…): sin detalles internos al cliente.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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
