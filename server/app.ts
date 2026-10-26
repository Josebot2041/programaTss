/**
 * Aplicación Express de la API (/api/*).
 */

import express from 'express';
import { validarEmpleadorRecibido, validarTituladoRecibido } from '../src/utils/validacion';
import { pool } from './db';
import {
  CAMPOS_EMPLEADOR,
  CAMPOS_TITULADO,
  empleadorDeFila,
  itemDeFila,
  sqlInsertar,
  tituladoDeFila,
  valoresEmpleador,
  valoresTitulado
} from './repositorio';

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  // Una encuesta ocupa pocos KB; se rechazan cuerpos más grandes.
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true, db: true });
    } catch {
      res.status(503).json({ ok: false, db: false });
    }
  });

  app.get('/api/titulados', async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM titulados ORDER BY id');
    res.json(rows.map(tituladoDeFila));
  });

  app.post('/api/titulados', async (req, res) => {
    const { errores, registro } = validarTituladoRecibido(req.body);
    if (!registro) {
      res.status(400).json({ errores });
      return;
    }
    const { rows } = await pool.query(sqlInsertar('titulados', CAMPOS_TITULADO), [...valoresTitulado(registro), 'formulario']);
    res.status(201).json(tituladoDeFila(rows[0]));
  });

  app.get('/api/empleadores', async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM empleadores ORDER BY id');
    res.json(rows.map(empleadorDeFila));
  });

  app.post('/api/empleadores', async (req, res) => {
    const { errores, registro } = validarEmpleadorRecibido(req.body);
    if (!registro) {
      res.status(400).json({ errores });
      return;
    }
    const { rows } = await pool.query(sqlInsertar('empleadores', CAMPOS_EMPLEADOR), [...valoresEmpleador(registro), 'formulario']);
    res.status(201).json(empleadorDeFila(rows[0]));
  });

  /** Textos de las 18 afirmaciones (los usa la pestaña de encuestas). */
  app.get('/api/items-empleadores', async (_req, res) => {
    const { rows } = await pool.query('SELECT codigo, afirmacion FROM items_empleadores ORDER BY codigo');
    res.json(rows.map(itemDeFila));
  });

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
