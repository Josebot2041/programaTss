/**
 * Acceso a la tabla usuarios y manejo de contraseñas (bcrypt, costo 12).
 * El hash nunca sale de este módulo hacia la API: las consultas que lo leen lo usan solo
 * para comparar.
 */

import bcrypt from 'bcryptjs';
import type pg from 'pg';
import type { Rol } from '../src/data/catalogos';
import type { Usuario } from '../src/utils/validacionUsuario';
import { pool } from './db';

export const COSTO_BCRYPT = 12;

/** Columnas públicas de un usuario (todas menos password_hash). */
export const COLUMNAS_USUARIO = 'id, nombre_completo, ci, rol, activo, created_at, ultimo_acceso';

export function usuarioDeFila(fila: Record<string, unknown>): Usuario {
  const fecha = (valor: unknown) => (valor instanceof Date ? valor.toISOString() : null);
  return {
    id: fila.id as number,
    nombre_completo: fila.nombre_completo as string,
    ci: fila.ci as string,
    rol: fila.rol as Rol,
    activo: fila.activo as boolean,
    created_at: fecha(fila.created_at) ?? '',
    ultimo_acceso: fecha(fila.ultimo_acceso)
  };
}

export async function leerUsuario(id: number, db: Pick<pg.Pool, 'query'> = pool): Promise<Usuario | undefined> {
  const { rows } = await db.query(`SELECT ${COLUMNAS_USUARIO} FROM usuarios WHERE id = $1`, [id]);
  return rows[0] ? usuarioDeFila(rows[0]) : undefined;
}

export const hashearPassword = (password: string) => bcrypt.hash(password, COSTO_BCRYPT);

// Hash de una contraseña al azar: se compara contra él cuando el CI no existe, para que la
// respuesta tarde lo mismo y no revele qué CI están registrados.
let hashFicticio: Promise<string> | undefined;

/** Compara la contraseña con el hash; sin hash (CI inexistente) siempre devuelve false. */
export async function verificarPassword(password: string, hash: string | undefined): Promise<boolean> {
  if (hash) return bcrypt.compare(password, hash);
  hashFicticio ??= hashearPassword(crypto.randomUUID());
  await bcrypt.compare(password, await hashFicticio);
  return false;
}

/** Cierra todas las sesiones abiertas de un usuario (al desactivarlo o eliminarlo). */
export async function cerrarSesionesDe(usuarioId: number, db: Pick<pg.Pool, 'query'> = pool): Promise<void> {
  await db.query(`DELETE FROM sesiones WHERE sess->>'usuarioId' = $1`, [String(usuarioId)]);
}
