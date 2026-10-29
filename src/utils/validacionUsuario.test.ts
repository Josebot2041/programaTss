import { describe, expect, it } from 'vitest';
import { errorCi, errorNombre, errorPassword, normalizarCi, validarLogin, validarRegistro } from './validacionUsuario';

describe('normalizarCi', () => {
  it.each([
    ['1234567', '1234567'],
    [' 12345 ', '12345'],
    ['1234567890', '1234567890'],
    ['1234567 LP', '1234567 LP'],
    ['1234567lp', '1234567 LP'],
    ['1234567-cb', '1234567 CB'],
    ['1234567  sc', '1234567 SC']
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarCi(entrada)).toBe(esperado);
  });

  it.each(['', '1234', '12345678901', '1234567 XX', '1234567 L', 'LP 1234567', '12a4567', '1234567 LPZ'])('rechaza «%s»', (entrada) => {
    expect(normalizarCi(entrada)).toBeUndefined();
  });
});

describe('reglas de la cuenta', () => {
  it('nombre: 3 a 100 caracteres, solo letras y signos de nombres', () => {
    expect(errorNombre('Ana')).toBeUndefined();
    expect(errorNombre("María José O'Brien-Pérez")).toBeUndefined();
    expect(errorNombre('  ')).toMatch(/Ingrese/);
    expect(errorNombre('Al')).toMatch(/entre 3 y 100/);
    expect(errorNombre('A'.repeat(101))).toMatch(/entre 3 y 100/);
    expect(errorNombre('Ana <script>')).toMatch(/solo puede tener letras/);
  });

  it('contraseña: al menos 8 caracteres, con una letra y un número', () => {
    expect(errorPassword('clave123')).toBeUndefined();
    expect(errorPassword('Ñandú2026')).toBeUndefined();
    expect(errorPassword('')).toMatch(/Ingrese/);
    expect(errorPassword('clave12')).toMatch(/al menos 8/);
    expect(errorPassword('clavesinnumero')).toMatch(/letra y un número/);
    expect(errorPassword('12345678')).toMatch(/letra y un número/);
    expect(errorPassword('a1'.repeat(37))).toMatch(/72/);
  });

  it('CI vacío y CI inválido tienen mensajes distintos', () => {
    expect(errorCi('')).toMatch(/Ingrese/);
    expect(errorCi('12')).toMatch(/de 5 a 10 dígitos/);
  });
});

describe('validarRegistro', () => {
  it('devuelve los datos normalizados', () => {
    const r = validarRegistro({ nombre_completo: '  Ana   Quispe ', ci: '1234567lp', password: 'clave123', confirmacion: 'clave123' });
    expect(r.errores).toEqual({});
    expect(r.datos).toEqual({ nombre_completo: 'Ana Quispe', ci: '1234567 LP', password: 'clave123' });
  });

  it('informa cada campo con error y no devuelve datos', () => {
    const r = validarRegistro({ nombre_completo: '', ci: 'x', password: 'abc', confirmacion: 'abd' });
    expect(Object.keys(r.errores).sort()).toEqual(['ci', 'confirmacion', 'nombre_completo', 'password']);
    expect(r.datos).toBeUndefined();
  });

  it('ignora valores que no son texto', () => {
    expect(validarRegistro(null).errores.ci).toMatch(/Ingrese/);
    expect(validarRegistro({ ci: 1234567, password: ['x'] }).errores.password).toMatch(/Ingrese/);
  });
});

describe('validarLogin', () => {
  it('solo exige ambos campos; un CI mal formado llega como undefined', () => {
    expect(validarLogin({ ci: '', password: '' }).errores).toEqual({ ci: 'Ingrese su CI', password: 'Ingrese su contraseña' });
    expect(validarLogin({ ci: '1234567 lp', password: 'x' }).datos).toEqual({ ci: '1234567 LP', password: 'x' });
    expect(validarLogin({ ci: 'abc', password: 'x' }).datos).toEqual({ ci: undefined, password: 'x' });
  });
});
