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
  tituladoDeFila,
  valoresEmpleador,
  valoresTitulado
} from './repositorio';

/** INSERT de una encuesta de formulario; todos los valores van como parámetros. */
function sqlInsertar(tabla: string, campos: string[]): string {
  const parametros = campos.map((_, i) => `$${i + 1}`);
  return `INSERT INTO ${tabla} (${campos.join(', ')}, origen) VALUES (${parametros.join(', ')}, 'formulario') RETURNING *`;
}

export function crearApp() {
  const app = express();
  app.use(express.json());

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
    const { rows } = await pool.query(sqlInsertar('titulados', CAMPOS_TITULADO), valoresTitulado(registro));
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
    const { rows } = await pool.query(sqlInsertar('empleadores', CAMPOS_EMPLEADOR), valoresEmpleador(registro));
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
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}
