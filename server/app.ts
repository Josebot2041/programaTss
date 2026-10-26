/**
 * Aplicación Express de la API (/api/*).
 */

import express from 'express';

export function crearApp() {
  const app = express();
  app.use(express.json());

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  return app;
}
