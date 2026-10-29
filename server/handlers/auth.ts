import { validarLogin, validarRegistro } from '../../src/utils/validacionUsuario';
import { pool } from '../db';
import { COLUMNAS_USUARIO, hashearPassword, usuarioDeFila, verificarPassword } from '../usuarios';
import type { Peticion, Respuesta } from './tipos';

/** Mismo mensaje para un CI inexistente y para una contraseña incorrecta. */
export const MENSAJE_LOGIN_INCORRECTO = 'CI o contraseña incorrectos';

/**
 * POST /api/auth/registro — crea una cuenta con rol 'usuario' (el rol del cuerpo se ignora)
 * e inicia sesión con ella.
 */
export async function registro({ body }: Peticion): Promise<Respuesta> {
  const { errores, datos } = validarRegistro(body);
  if (!datos) return { status: 400, body: { errores } };
  const hash = await hashearPassword(datos.password);
  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre_completo, ci, password_hash, rol, ultimo_acceso)
     VALUES ($1, $2, $3, 'usuario', now())
     ON CONFLICT (ci) DO NOTHING
     RETURNING ${COLUMNAS_USUARIO}`,
    [datos.nombre_completo, datos.ci, hash]
  );
  if (rows.length === 0) return { status: 409, body: { errores: { ci: 'Ya existe una cuenta con este CI' } } };
  const usuario = usuarioDeFila(rows[0]);
  return { status: 201, body: usuario, sesion: { usuarioId: usuario.id } };
}

/** POST /api/auth/login — con CI y contraseña correctos inicia sesión y registra el acceso. */
export async function login({ body }: Peticion): Promise<Respuesta> {
  const { errores, datos } = validarLogin(body);
  if (!datos) return { status: 400, body: { errores } };
  const fila = datos.ci
    ? (await pool.query<{ id: number; activo: boolean; password_hash: string }>(
        'SELECT id, activo, password_hash FROM usuarios WHERE ci = $1',
        [datos.ci]
      )).rows[0]
    : undefined;
  // Se compara siempre (aunque el CI no exista) para no revelar por el tiempo qué CI existen.
  const correcta = await verificarPassword(datos.password, fila?.password_hash);
  if (!fila || !correcta) return { status: 401, body: { error: MENSAJE_LOGIN_INCORRECTO } };
  if (!fila.activo) return { status: 403, body: { error: 'Su cuenta está desactivada. Consulte con un administrador.' } };
  const { rows } = await pool.query(`UPDATE usuarios SET ultimo_acceso = now() WHERE id = $1 RETURNING ${COLUMNAS_USUARIO}`, [fila.id]);
  return { status: 200, body: usuarioDeFila(rows[0]), sesion: { usuarioId: fila.id } };
}

/** POST /api/auth/logout — cierra la sesión (si no hay sesión, no hace nada). */
export async function logout(): Promise<Respuesta> {
  return { status: 200, body: { ok: true }, sesion: 'cerrar' };
}

/** GET /api/auth/yo — usuario con sesión, sin el hash de la contraseña. */
export async function yo({ usuario }: Peticion): Promise<Respuesta> {
  return { status: 200, body: usuario };
}
