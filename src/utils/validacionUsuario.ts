/**
 * Reglas de las cuentas de usuario. Las usan los formularios de acceso (para avisar antes de
 * enviar) y la API (que es la que decide). Las restricciones de la tabla usuarios
 * (db/schema.sql) repiten el formato del CI y los límites del nombre.
 */

import { EXTENSIONES_CI, ROLES, type Rol } from '../data/catalogos';
import type { Errores } from './validacion';

export const NOMBRE_MIN = 3;
export const NOMBRE_MAX = 100;
export const PASSWORD_MIN = 8;
/** bcrypt ignora lo que pase de 72 bytes; una contraseña más larga se rechaza. */
export const PASSWORD_MAX_BYTES = 72;

/** Usuario tal como lo devuelve la API (nunca incluye el hash de la contraseña). */
export interface Usuario {
  id: number;
  nombre_completo: string;
  ci: string;
  rol: Rol;
  activo: boolean;
  created_at: string;
  ultimo_acceso: string | null;
}

export interface DatosRegistro {
  nombre_completo: string;
  ci: string;
  password: string;
}

/** Quita los espacios de los extremos y deja uno solo entre palabras. */
export const normalizarNombre = (nombre: string) => nombre.trim().replace(/\s+/g, ' ');

/**
 * Devuelve el CI en su forma guardada ("1234567" o "1234567 LP") o undefined si no es válido.
 * Acepta la extensión en minúsculas y separada por espacio, guion o sin separador.
 */
export function normalizarCi(ci: string): string | undefined {
  const m = /^(\d{5,10})(?:[\s.-]*([A-Za-z]{2}))?$/.exec(ci.trim());
  if (!m) return undefined;
  const extension = m[2]?.toUpperCase();
  if (extension && !(EXTENSIONES_CI as readonly string[]).includes(extension)) return undefined;
  return extension ? `${m[1]} ${extension}` : m[1];
}

export function errorNombre(nombre: string): string | undefined {
  const n = normalizarNombre(nombre);
  if (n === '') return 'Ingrese su nombre completo';
  if (n.length < NOMBRE_MIN || n.length > NOMBRE_MAX) return `El nombre debe tener entre ${NOMBRE_MIN} y ${NOMBRE_MAX} caracteres`;
  if (!/^\p{L}[\p{L}\p{M} .'-]*$/u.test(n)) return 'El nombre solo puede tener letras, espacios, puntos, apóstrofos y guiones';
  return undefined;
}

export function errorCi(ci: string): string | undefined {
  if (ci.trim() === '') return 'Ingrese su CI';
  if (normalizarCi(ci) === undefined) {
    return `El CI debe tener de 5 a 10 dígitos y, opcionalmente, la extensión (${EXTENSIONES_CI.join(', ')})`;
  }
  return undefined;
}

export function errorPassword(password: string): string | undefined {
  if (password === '') return 'Ingrese una contraseña';
  if (password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return `La contraseña no puede superar ${PASSWORD_MAX_BYTES} caracteres`;
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return 'La contraseña debe tener al menos una letra y un número';
  return undefined;
}

const texto = (valor: unknown) => (typeof valor === 'string' ? valor : '');

/** Valida el formulario "Crear cuenta". Devuelve los datos normalizados si no hay errores. */
export function validarRegistro(entrada: unknown): { errores: Errores; datos?: DatosRegistro } {
  const e = (typeof entrada === 'object' && entrada !== null ? entrada : {}) as Record<string, unknown>;
  const nombre = texto(e.nombre_completo);
  const ci = texto(e.ci);
  const password = texto(e.password);
  const errores: Errores = {};

  const enNombre = errorNombre(nombre);
  if (enNombre) errores.nombre_completo = enNombre;
  const enCi = errorCi(ci);
  if (enCi) errores.ci = enCi;
  const enPassword = errorPassword(password);
  if (enPassword) errores.password = enPassword;
  if (texto(e.confirmacion) === '') errores.confirmacion = 'Repita la contraseña';
  else if (e.confirmacion !== password) errores.confirmacion = 'Las contraseñas no coinciden';

  if (Object.keys(errores).length > 0) return { errores };
  return { errores, datos: { nombre_completo: normalizarNombre(nombre), ci: normalizarCi(ci)!, password } };
}

/**
 * Valida el formulario "Iniciar sesión": solo exige que ambos campos estén completos.
 * `ci` es undefined si no tiene el formato de un CI; la API responde entonces con el mismo
 * mensaje genérico que para un CI inexistente.
 */
export function validarLogin(entrada: unknown): { errores: Errores; datos?: { ci: string | undefined; password: string } } {
  const e = (typeof entrada === 'object' && entrada !== null ? entrada : {}) as Record<string, unknown>;
  const ci = texto(e.ci);
  const password = texto(e.password);
  const errores: Errores = {};
  if (ci.trim() === '') errores.ci = 'Ingrese su CI';
  if (password === '') errores.password = 'Ingrese su contraseña';
  if (Object.keys(errores).length > 0) return { errores };
  return { errores, datos: { ci: normalizarCi(ci), password } };
}

export const esRol = (valor: unknown): valor is Rol => (ROLES as readonly unknown[]).includes(valor);
