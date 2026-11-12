import { validarLogin } from '../../src/utils/validacionUsuario';
import { pool } from '../db';
import { COLUMNAS_USUARIO, usuarioDeFila, verificarPassword } from '../usuarios';
import type { Peticion, Respuesta } from './tipos';

/** Mismo mensaje para un CI inexistente y para una contraseña incorrecta. */
export const MENSAJE_LOGIN_INCORRECTO = 'CI o contraseña incorrectos';
export const MENSAJE_SIN_PERMISOS_ADMIN = 'No tiene permisos de administrador';

/**
 * POST /api/auth/login — acceso al panel: solo los administradores activos inician sesión (los
 * encuestados no necesitan cuenta y los administradores se crean con npm run crear-admin).
 */
export async function login({ body }: Peticion): Promise<Respuesta> {
  const { errores, datos } = validarLogin(body);
  if (!datos) return { status: 400, body: { errores } };
  const fila = datos.ci
    ? (await pool.query<{ id: number; activo: boolean; rol: string; password_hash: string }>(
        'SELECT id, activo, rol, password_hash FROM usuarios WHERE ci = $1',
        [datos.ci]
      )).rows[0]
    : undefined;
  // Se compara siempre (aunque el CI no exista) para no revelar por el tiempo qué CI existen.
  const correcta = await verificarPassword(datos.password, fila?.password_hash);
  if (!fila || !correcta) return { status: 401, body: { error: MENSAJE_LOGIN_INCORRECTO } };
  if (!fila.activo) return { status: 403, body: { error: 'Su cuenta está desactivada. Consulte con un administrador.' } };
  if (fila.rol !== 'admin') return { status: 403, body: { error: MENSAJE_SIN_PERMISOS_ADMIN } };
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
