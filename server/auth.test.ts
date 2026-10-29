/**
 * Pruebas de la API de autenticación y administración contra la base PostgreSQL de .env.
 * Levantan la aplicación Express en un puerto libre, crean usuarios de prueba con CI que
 * empiezan con 95 y los borran (junto con sus sesiones) al terminar.
 * Si no hay DATABASE_URL o la base no tiene la tabla usuarios (npm run db:init), se omiten.
 */
import 'dotenv/config';
import { randomBytes, randomInt } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.SESSION_SECRET ??= randomBytes(48).toString('base64url');

async function baseDisponible(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  const { pool } = await import('./db');
  return pool.query(`SELECT to_regclass('usuarios') IS NOT NULL AS ok`).then(
    (r) => r.rows[0].ok as boolean,
    () => false
  );
}
const hayBase = await baseDisponible();
if (!hayBase) console.warn('Pruebas de la API omitidas: sin base de datos (DATABASE_URL y npm run db:init).');

/** CI único de prueba: 95 + 7 dígitos. */
const cisCreados: string[] = [];
function nuevoCi(): string {
  const ci = `95${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
  cisCreados.push(ci);
  return ci;
}

interface RespuestaPrueba {
  status: number;
  body: any;
  headers: Headers;
}

let base = '';

/** Cliente HTTP con su propia cookie de sesión (como un navegador). */
class Cliente {
  cookie = '';
  async pedir(metodo: string, ruta: string, cuerpo?: unknown): Promise<RespuestaPrueba> {
    const res = await fetch(`${base}/api/${ruta}`, {
      method: metodo,
      headers: { ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }), ...(this.cookie && { Cookie: this.cookie }) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0].endsWith('=') ? '' : setCookie.split(';')[0];
    const texto = await res.text();
    return { status: res.status, body: texto ? JSON.parse(texto) : undefined, headers: res.headers };
  }
  registrar(nombre: string, ci: string, password = 'clave1234', confirmacion = password) {
    return this.pedir('POST', 'auth/registro', { nombre_completo: nombre, ci, password, confirmacion });
  }
  login(ci: string, password: string) {
    return this.pedir('POST', 'auth/login', { ci, password });
  }
}

describe.skipIf(!hayBase)('API de autenticación', () => {
  let servidor: Server;
  let pool: typeof import('./db').pool;
  const admin = { ci: '', password: 'Admin' + randomBytes(6).toString('hex') + '1', id: 0 };
  const clienteAdmin = new Cliente();

  beforeAll(async () => {
    ({ pool } = await import('./db'));
    const { crearApp } = await import('./app');
    const { hashearPassword } = await import('./usuarios');
    servidor = crearApp().listen(0);
    await new Promise((resolve) => servidor.once('listening', resolve));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

    // Administrador de prueba (la API no permite crearlos: solo npm run crear-admin)
    admin.ci = nuevoCi();
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre_completo, ci, password_hash, rol) VALUES ('Admin De Prueba', $1, $2, 'admin') RETURNING id`,
      [admin.ci, await hashearPassword(admin.password)]
    );
    admin.id = rows[0].id;
    expect((await clienteAdmin.login(admin.ci, admin.password)).status).toBe(200);
  });

  afterAll(async () => {
    servidor?.close();
    if (!pool) return;
    const { rows } = await pool.query<{ id: number }>('SELECT id FROM usuarios WHERE ci LIKE ANY ($1)', [cisCreados.map((ci) => `${ci}%`)]);
    const ids = rows.map((r) => String(r.id));
    await pool.query(`DELETE FROM sesiones WHERE sess->>'usuarioId' = ANY ($1)`, [ids]);
    await pool.query('DELETE FROM usuarios WHERE id = ANY ($1::int[])', [ids]);
    await pool.end();
  });

  describe('registro', () => {
    it('crea una cuenta con rol usuario, inicia sesión y no devuelve el hash', async () => {
      const c = new Cliente();
      const ci = nuevoCi();
      const r = await c.pedir('POST', 'auth/registro', {
        nombre_completo: '  Ana   Quispe ',
        ci: `${ci}-lp`,
        password: 'clave1234',
        confirmacion: 'clave1234',
        rol: 'admin'
      });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ nombre_completo: 'Ana Quispe', ci: `${ci} LP`, rol: 'usuario', activo: true });
      expect(r.body).not.toHaveProperty('password_hash');
      const cookie = r.headers.get('set-cookie') ?? '';
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
      expect(cookie).not.toMatch(/Secure/); // solo en producción

      const yo = await c.pedir('GET', 'auth/yo');
      expect(yo.status).toBe(200);
      expect(yo.body.id).toBe(r.body.id);
      expect(JSON.stringify(yo.body)).not.toMatch(/password|\$2[aby]\$/);

      const { rows } = await pool.query('SELECT password_hash FROM usuarios WHERE id = $1', [r.body.id]);
      expect(rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, costo 12
    });

    it('rechaza un CI duplicado (también escrito de otra forma)', async () => {
      const ci = nuevoCi();
      expect((await new Cliente().registrar('Primera Persona', `${ci} CB`)).status).toBe(201);
      const r = await new Cliente().registrar('Segunda Persona', `${ci}cb`);
      expect(r.status).toBe(409);
      expect(r.body.errores.ci).toMatch(/Ya existe/);
      expect(r.headers.get('set-cookie')).toBeNull();
    });

    it.each([
      ['corta', 'clave12', 'al menos 8 caracteres'],
      ['sin número', 'clavesinnumero', 'una letra y un número'],
      ['sin letra', '1234567890', 'una letra y un número']
    ])('rechaza una contraseña débil (%s)', async (_caso, password, mensaje) => {
      const ci = nuevoCi();
      const r = await new Cliente().registrar('Persona Débil', ci, password);
      expect(r.status).toBe(400);
      expect(r.body.errores.password).toMatch(mensaje);
      expect((await pool.query('SELECT 1 FROM usuarios WHERE ci = $1', [ci])).rowCount).toBe(0);
    });

    it('valida la confirmación, el nombre y el formato del CI', async () => {
      const r = await new Cliente().pedir('POST', 'auth/registro', { nombre_completo: 'Al', ci: '12AB', password: 'clave1234', confirmacion: 'otra1234' });
      expect(r.status).toBe(400);
      expect(Object.keys(r.body.errores).sort()).toEqual(['ci', 'confirmacion', 'nombre_completo']);
    });
  });

  describe('login', () => {
    const ci = nuevoCi();
    beforeAll(async () => {
      expect((await new Cliente().registrar('Usuario Login', ci, 'correcta123')).status).toBe(201);
    });

    it('con datos correctos inicia sesión y actualiza ultimo_acceso', async () => {
      await pool.query(`UPDATE usuarios SET ultimo_acceso = now() - interval '1 day' WHERE ci = $1`, [ci]);
      const c = new Cliente();
      const r = await c.login(ci, 'correcta123');
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ ci, rol: 'usuario' });
      expect(r.body).not.toHaveProperty('password_hash');
      expect(Date.now() - new Date(r.body.ultimo_acceso).getTime()).toBeLessThan(60_000);
      expect((await c.pedir('GET', 'auth/yo')).status).toBe(200);
    });

    it('responde lo mismo para una contraseña incorrecta y para un CI inexistente', async () => {
      const incorrecta = await new Cliente().login(ci, 'incorrecta1');
      const inexistente = await new Cliente().login(nuevoCi(), 'incorrecta1');
      const malFormado = await new Cliente().login('abc', 'incorrecta1');
      for (const r of [incorrecta, inexistente, malFormado]) {
        expect(r.status).toBe(401);
        expect(r.body).toEqual({ error: 'CI o contraseña incorrectos' });
        expect(r.headers.get('set-cookie')).toBeNull();
      }
    });

    it('no deja entrar a una cuenta desactivada', async () => {
      const otro = nuevoCi();
      await new Cliente().registrar('Usuario Inactivo', otro, 'correcta123');
      await pool.query('UPDATE usuarios SET activo = false WHERE ci = $1', [otro]);
      const r = await new Cliente().login(otro, 'correcta123');
      expect(r.status).toBe(403);
      expect(r.headers.get('set-cookie')).toBeNull();
    });

    it('cierra la sesión con logout y la cookie anterior deja de servir', async () => {
      const c = new Cliente();
      await c.login(ci, 'correcta123');
      const cookieAnterior = c.cookie;
      expect((await c.pedir('POST', 'auth/logout')).status).toBe(200);
      expect(c.cookie).toBe('');
      expect((await c.pedir('GET', 'auth/yo')).status).toBe(401);
      c.cookie = cookieAnterior;
      expect((await c.pedir('GET', 'auth/yo')).status).toBe(401);
    });
  });

  describe('límite de intentos', () => {
    it('bloquea el sexto intento tras 5 logins fallidos del mismo CI e IP, aunque sea correcto', async () => {
      const ci = nuevoCi();
      await new Cliente().registrar('Usuario Bloqueado', ci, 'correcta123');
      for (let i = 1; i <= 5; i++) expect((await new Cliente().login(ci, `incorrecta${i}`)).status).toBe(401);

      const bloqueado = await new Cliente().login(ci, 'correcta123');
      expect(bloqueado.status).toBe(429);
      expect(bloqueado.body.error).toMatch(/Demasiados intentos/);
      expect(Number(bloqueado.headers.get('retry-after'))).toBeGreaterThan(0);

      // Otro CI desde la misma IP no queda bloqueado
      expect((await new Cliente().login(nuevoCi(), 'incorrecta1')).status).toBe(401);
    });

    it('los logins exitosos no cuentan como intentos', async () => {
      const ci = nuevoCi();
      await new Cliente().registrar('Usuario Constante', ci, 'correcta123');
      for (let i = 0; i < 6; i++) expect((await new Cliente().login(ci, 'correcta123')).status).toBe(200);
    });
  });

  describe('rutas protegidas', () => {
    const protegidas: Array<[string, string]> = [
      ['GET', 'auth/yo'],
      ['GET', 'titulados'],
      ['POST', 'titulados'],
      ['GET', 'empleadores'],
      ['POST', 'empleadores'],
      ['GET', 'items-empleadores'],
      ['GET', 'admin/usuarios'],
      ['PATCH', 'admin/usuarios/1'],
      ['DELETE', 'admin/usuarios/1'],
      ['GET', 'admin/resumen']
    ];

    it.each(protegidas)('%s /api/%s sin sesión responde 401', async (metodo, ruta) => {
      const r = await new Cliente().pedir(metodo, ruta, metodo === 'GET' || metodo === 'DELETE' ? undefined : {});
      expect(r.status).toBe(401);
      expect(r.body.error).toBe('Debe iniciar sesión');
    });

    it('/api/health sigue siendo público', async () => {
      expect((await new Cliente().pedir('GET', 'health')).status).toBe(200);
    });

    it('con sesión de usuario se pueden leer los datos', async () => {
      const c = new Cliente();
      await c.registrar('Usuario Lector', nuevoCi());
      const r = await c.pedir('GET', 'titulados');
      expect(r.status).toBe(200);
      expect(r.body.length).toBeGreaterThanOrEqual(148);
    });

    it.each(protegidas.filter(([, ruta]) => ruta.startsWith('admin/')))(
      '%s /api/%s con un usuario normal responde 403',
      async (metodo, ruta) => {
        const c = new Cliente();
        await c.registrar('Usuario Curioso', nuevoCi());
        const r = await c.pedir(metodo, ruta, metodo === 'PATCH' ? { activo: false } : undefined);
        expect(r.status).toBe(403);
      }
    );
  });

  describe('administración', () => {
    it('lista usuarios con búsqueda por nombre o CI y paginación', async () => {
      const ci = nuevoCi();
      await new Cliente().registrar('Zacarías Buscable', ci);
      const porNombre = await clienteAdmin.pedir('GET', 'admin/usuarios?buscar=zacarías buscable');
      expect(porNombre.status).toBe(200);
      expect(porNombre.body.total).toBe(1);
      expect(porNombre.body.usuarios[0]).toMatchObject({ ci, rol: 'usuario' });
      expect(porNombre.body.usuarios[0]).not.toHaveProperty('password_hash');

      const porCi = await clienteAdmin.pedir('GET', `admin/usuarios?buscar=${ci}`);
      expect(porCi.body.usuarios.map((u: { ci: string }) => u.ci)).toEqual([ci]);

      const pagina = await clienteAdmin.pedir('GET', 'admin/usuarios?pagina=1&por_pagina=2');
      expect(pagina.body.usuarios).toHaveLength(2);
      expect(pagina.body.total).toBeGreaterThan(2);
      expect((await clienteAdmin.pedir('GET', 'admin/usuarios?pagina=0')).status).toBe(400);
      // % y _ se buscan literalmente
      expect((await clienteAdmin.pedir('GET', 'admin/usuarios?buscar=%25')).body.total).toBe(0);
    });

    it('activa, desactiva y cambia el rol; desactivar cierra las sesiones del usuario', async () => {
      const c = new Cliente();
      const { body: u } = await c.registrar('Usuario Gestionado', nuevoCi());

      const promovido = await clienteAdmin.pedir('PATCH', `admin/usuarios/${u.id}`, { rol: 'admin' });
      expect(promovido.body).toMatchObject({ rol: 'admin', activo: true });
      expect((await c.pedir('GET', 'admin/resumen')).status).toBe(200); // el cambio rige de inmediato

      const desactivado = await clienteAdmin.pedir('PATCH', `admin/usuarios/${u.id}`, { rol: 'usuario', activo: false });
      expect(desactivado.body).toMatchObject({ rol: 'usuario', activo: false });
      expect((await c.pedir('GET', 'auth/yo')).status).toBe(401);

      expect((await clienteAdmin.pedir('PATCH', `admin/usuarios/${u.id}`, { activo: true })).body.activo).toBe(true);
      expect((await clienteAdmin.pedir('PATCH', `admin/usuarios/${u.id}`, { rol: 'jefe' })).status).toBe(400);
      expect((await clienteAdmin.pedir('PATCH', `admin/usuarios/${u.id}`, {})).status).toBe(400);
      expect((await clienteAdmin.pedir('PATCH', 'admin/usuarios/999999999', { activo: true })).status).toBe(404);
    });

    it('un administrador no puede desactivarse, quitarse el rol ni eliminarse', async () => {
      for (const [metodo, cuerpo, mensaje] of [
        ['PATCH', { activo: false }, 'desactivar su propia cuenta'],
        ['PATCH', { rol: 'usuario' }, 'quitarse su propio rol'],
        ['DELETE', undefined, 'eliminar su propia cuenta']
      ] as const) {
        const r = await clienteAdmin.pedir(metodo, `admin/usuarios/${admin.id}`, cuerpo);
        expect(r.status).toBe(400);
        expect(r.body.error).toMatch(mensaje);
      }
      const { rows } = await pool.query('SELECT rol, activo FROM usuarios WHERE id = $1', [admin.id]);
      expect(rows[0]).toEqual({ rol: 'admin', activo: true });
    });

    it('elimina una cuenta y sus sesiones', async () => {
      const c = new Cliente();
      const { body: u } = await c.registrar('Usuario Eliminado', nuevoCi());
      expect((await clienteAdmin.pedir('DELETE', `admin/usuarios/${u.id}`)).status).toBe(200);
      expect((await c.pedir('GET', 'auth/yo')).status).toBe(401);
      expect((await pool.query(`SELECT 1 FROM sesiones WHERE sess->>'usuarioId' = $1`, [String(u.id)])).rowCount).toBe(0);
      expect((await clienteAdmin.pedir('DELETE', `admin/usuarios/${u.id}`)).status).toBe(404);
    });

    it('resume usuarios, encuestas por origen y los últimos 7 días', async () => {
      const r = await clienteAdmin.pedir('GET', 'admin/resumen');
      expect(r.status).toBe(200);
      const { usuarios, titulados, empleadores, ultimos_7_dias } = r.body;
      expect(usuarios.admins).toBeGreaterThanOrEqual(1);
      expect(usuarios.total).toBeGreaterThanOrEqual(usuarios.activos);
      expect(titulados.base_oficial).toBe(148);
      expect(empleadores.base_oficial).toBe(51);
      expect(titulados.total).toBe(titulados.base_oficial + titulados.formulario);
      expect(ultimos_7_dias.por_dia).toHaveLength(7);
      expect(ultimos_7_dias.usuarios).toBeGreaterThanOrEqual(1); // los creados por estas pruebas
      const suma = ultimos_7_dias.por_dia.reduce((s: number, d: { titulados: number }) => s + d.titulados, 0);
      expect(suma).toBe(ultimos_7_dias.titulados);
    });
  });
});
