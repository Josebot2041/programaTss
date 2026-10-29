/**
 * Sesiones del servidor (express-session + connect-pg-simple, tabla "sesiones"), middlewares
 * de acceso y límite de intentos de login.
 *
 * La cookie solo guarda el id de la sesión (httpOnly, SameSite=Lax y Secure en producción).
 * Cada petición protegida vuelve a leer el usuario de la base: si fue desactivado o eliminado,
 * o si cambió su rol, el cambio rige de inmediato.
 */

import connectPgSimple from 'connect-pg-simple';
import type express from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import session from 'express-session';
import { normalizarCi } from '../src/utils/validacionUsuario';
import { pool } from './db';
import { leerUsuario } from './usuarios';

declare module 'express-session' {
  interface SessionData {
    usuarioId: number;
  }
}

export const NOMBRE_COOKIE = 'arcusur.sid';
const DURACION_SESION_MS = 8 * 60 * 60 * 1000; // 8 horas sin actividad
const VENTANA_LOGIN_MS = 15 * 60 * 1000;
const MAX_LOGINS_FALLIDOS = 5;

export const enProduccion = () => process.env.NODE_ENV === 'production';

function secreto(): string {
  const valor = process.env.SESSION_SECRET;
  if (!valor || valor.length < 32) {
    throw new Error(
      'Falta SESSION_SECRET en .env (al menos 32 caracteres al azar). Puede generarlo con: ' +
        `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
    );
  }
  return valor;
}

export function crearMiddlewareSesion(): express.RequestHandler {
  const PgStore = connectPgSimple(session);
  return session({
    name: NOMBRE_COOKIE,
    secret: secreto(),
    store: new PgStore({ pool, tableName: 'sesiones', createTableIfMissing: false }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: enProduccion(),
      maxAge: DURACION_SESION_MS
    }
  });
}

const promesa = (fn: (listo: (err?: unknown) => void) => void) =>
  new Promise<void>((resolve, reject) => fn((err) => (err ? reject(err) : resolve())));

/** Inicia sesión con un id nuevo (evita la fijación de sesión). */
export async function iniciarSesion(req: express.Request, usuarioId: number): Promise<void> {
  await promesa((listo) => req.session.regenerate(listo));
  req.session.usuarioId = usuarioId;
  await promesa((listo) => req.session.save(listo));
}

export async function cerrarSesion(req: express.Request, res: express.Response): Promise<void> {
  await promesa((listo) => req.session.destroy(listo));
  res.clearCookie(NOMBRE_COOKIE, { httpOnly: true, sameSite: 'lax', secure: enProduccion() });
}

/** Exige una sesión válida de un usuario activo; deja el usuario en res.locals.usuario. */
export const requiereSesion: express.RequestHandler = async (req, res, next) => {
  const id = req.session.usuarioId;
  const usuario = id === undefined ? undefined : await leerUsuario(id);
  if (!usuario?.activo) {
    if (id !== undefined) await cerrarSesion(req, res);
    res.status(401).json({ error: 'Debe iniciar sesión' });
    return;
  }
  res.locals.usuario = usuario;
  next();
};

/** Exige que el usuario (ya validado por requiereSesion) sea administrador. */
export const requiereAdmin: express.RequestHandler = (_req, res, next) => {
  const usuario = res.locals.usuario as { rol?: string } | undefined;
  if (!usuario) {
    res.status(401).json({ error: 'Debe iniciar sesión' });
    return;
  }
  if (usuario.rol !== 'admin') {
    res.status(403).json({ error: 'No tiene permisos para esta acción' });
    return;
  }
  next();
};

/**
 * Hasta 5 logins fallidos por combinación de CI e IP cada 15 minutos; los exitosos no cuentan.
 * Se crea uno por aplicación (el contador vive en memoria del proceso).
 */
export function crearLimiteLogin(): express.RequestHandler {
  return rateLimit({
    windowMs: VENTANA_LOGIN_MS,
    limit: MAX_LOGINS_FALLIDOS,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const ci = typeof req.body?.ci === 'string' ? req.body.ci : '';
      return `${ipKeyGenerator(req.ip ?? '')}|${normalizarCi(ci) ?? ci.trim().toUpperCase().slice(0, 20)}`;
    },
    handler: (req, res) => {
      const reinicio = (req as express.Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      const minutos = reinicio ? Math.max(1, Math.ceil((reinicio.getTime() - Date.now()) / 60000)) : 15;
      res.status(429).json({
        error: `Demasiados intentos fallidos. Espere ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} antes de volver a intentar.`
      });
    }
  });
}
