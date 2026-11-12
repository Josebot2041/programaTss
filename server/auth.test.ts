/**
 * Pruebas de la API de autenticación, administración y encuestas públicas contra la base
 * PostgreSQL de .env. Levantan la aplicación Express en un puerto libre, crean usuarios de prueba
 * con CI que empiezan con 95 y los borran (junto con sus sesiones y las encuestas que envían) al
 * terminar. Si no hay DATABASE_URL o la base no tiene la tabla usuarios (npm run db:init), se omiten.
 */
import 'dotenv/config';
import { randomBytes, randomInt } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BORRADOR_TITULADO_VACIO, CAMPO_TRAMPA, type BorradorTitulado } from '../src/utils/validacion';

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

/** Cliente HTTP con su propia cookie de sesión (como un navegador). */
class Cliente {
  cookie = '';
  constructor(private readonly base: () => string) {}
  async pedir(metodo: string, ruta: string, cuerpo?: unknown): Promise<RespuestaPrueba> {
    const res = await fetch(`${this.base()}/api/${ruta}`, {
      method: metodo,
      headers: { ...(cuerpo !== undefined && { 'Content-Type': 'application/json' }), ...(this.cookie && { Cookie: this.cookie }) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0].endsWith('=') ? '' : setCookie.split(';')[0];
    const texto = await res.text();
    return { status: res.status, body: texto ? JSON.parse(texto) : undefined, headers: res.headers };
  }
  login(ci: string, password: string) {
    return this.pedir('POST', 'auth/login', { ci, password });
  }
}

/** Encuesta de titulado válida (mínima). */
const TITULADO_VALIDO: BorradorTitulado = {
  ...BORRADOR_TITULADO_VACIO,
  edad: '23 - 26 años',
  genero: 'Mujer',
  anios_vida_profesional: '3',
  anios_desempleado: '0',
  formacion_complementaria: 'No',
  interes_posgrado: 'No',
  situacion_laboral: 'No trabaja',
  satisfaccion_global: 3,
  concordancia_formacion: 3,
  opinion_posgrado_fcyt: 3
};

describe.skipIf(!hayBase)('API de autenticación', () => {
  let servidor: Server;
  let base = '';
  let pool: typeof import('./db').pool;
  let hashearPassword: typeof import('./usuarios').hashearPassword;
  const nuevoCliente = () => new Cliente(() => base);
  const PASSWORD = 'Clave' + randomBytes(6).toString('hex') + '1';
  const admin = { ci: '', id: 0 };
  const clienteAdmin = nuevoCliente();
  const tituladosCreados: number[] = [];

  /** Usuario de prueba creado directamente en la base (la API no permite registrarse). */
  async function crearUsuario(nombre: string, rol: 'usuario' | 'admin' = 'usuario') {
    const ci = nuevoCi();
    const { rows } = await pool.query<{ id: number }>(
      'INSERT INTO usuarios (nombre_completo, ci, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id',
      [nombre, ci, await hashearPassword(PASSWORD), rol]
    );
    return { id: rows[0].id, ci };
  }

  /** Cliente con sesión de un administrador nuevo. */
  async function nuevoAdmin(nombre: string) {
    const u = await crearUsuario(nombre, 'admin');
    const c = nuevoCliente();
    expect((await c.login(u.ci, PASSWORD)).status).toBe(200);
    return { ...u, cliente: c };
  }

  beforeAll(async () => {
    ({ pool } = await import('./db'));
    ({ hashearPassword } = await import('./usuarios'));
    const { crearApp } = await import('./app');
    servidor = crearApp().listen(0);
    await new Promise((resolve) => servidor.once('listening', resolve));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

    Object.assign(admin, await crearUsuario('Admin De Prueba', 'admin'));
    expect((await clienteAdmin.login(admin.ci, PASSWORD)).status).toBe(200);
  });

  afterAll(async () => {
    servidor?.close();
    if (!pool) return;
    const { rows } = await pool.query<{ id: number }>('SELECT id FROM usuarios WHERE ci LIKE ANY ($1)', [cisCreados.map((ci) => `${ci}%`)]);
    const ids = rows.map((r) => String(r.id));
    await pool.query(`DELETE FROM sesiones WHERE sess->>'usuarioId' = ANY ($1)`, [ids]);
    await pool.query('DELETE FROM usuarios WHERE id = ANY ($1::int[])', [ids]);
    await pool.query('DELETE FROM titulados WHERE id = ANY ($1::int[])', [tituladosCreados]);
    await pool.end();
  });

  describe('login de administrador', () => {
    it('un administrador inicia sesión con una cookie segura y sin recibir el hash', async () => {
      const u = await crearUsuario('Ana Administradora', 'admin');
      await pool.query(`UPDATE usuarios SET ultimo_acceso = now() - interval '1 day' WHERE id = $1`, [u.id]);
      const c = nuevoCliente();
      const r = await c.login(u.ci, PASSWORD);
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ ci: u.ci, rol: 'admin', activo: true });
      expect(r.body).not.toHaveProperty('password_hash');
      expect(Date.now() - new Date(r.body.ultimo_acceso).getTime()).toBeLessThan(60_000);
      const cookie = r.headers.get('set-cookie') ?? '';
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
      expect(cookie).not.toMatch(/Secure/); // solo en producción

      const yo = await c.pedir('GET', 'auth/yo');
      expect(yo.status).toBe(200);
      expect(JSON.stringify(yo.body)).not.toMatch(/password|\$2[aby]\$/);
      const { rows } = await pool.query('SELECT password_hash FROM usuarios WHERE id = $1', [u.id]);
      expect(rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, costo 12
    });

    it('un usuario sin rol admin no entra aunque la contraseña sea correcta', async () => {
      const u = await crearUsuario('Usuario Sin Permisos');
      const r = await nuevoCliente().login(u.ci, PASSWORD);
      expect(r.status).toBe(403);
      expect(r.body).toEqual({ error: 'No tiene permisos de administrador' });
      expect(r.headers.get('set-cookie')).toBeNull();
    });

    it('responde lo mismo para una contraseña incorrecta y para un CI inexistente', async () => {
      const incorrecta = await nuevoCliente().login(admin.ci, 'incorrecta1');
      const inexistente = await nuevoCliente().login(nuevoCi(), 'incorrecta1');
      const malFormado = await nuevoCliente().login('abc', 'incorrecta1');
      for (const r of [incorrecta, inexistente, malFormado]) {
        expect(r.status).toBe(401);
        expect(r.body).toEqual({ error: 'CI o contraseña incorrectos' });
        expect(r.headers.get('set-cookie')).toBeNull();
      }
    });

    it('no deja entrar a una cuenta desactivada', async () => {
      const u = await crearUsuario('Admin Inactivo', 'admin');
      await pool.query('UPDATE usuarios SET activo = false WHERE id = $1', [u.id]);
      const r = await nuevoCliente().login(u.ci, PASSWORD);
      expect(r.status).toBe(403);
      expect(r.headers.get('set-cookie')).toBeNull();
    });

    it('cierra la sesión con logout y la cookie anterior deja de servir', async () => {
      const { cliente: c } = await nuevoAdmin('Admin Que Sale');
      const cookieAnterior = c.cookie;
      expect((await c.pedir('POST', 'auth/logout')).status).toBe(200);
      expect(c.cookie).toBe('');
      expect((await c.pedir('GET', 'auth/yo')).status).toBe(401);
      c.cookie = cookieAnterior;
      expect((await c.pedir('GET', 'auth/yo')).status).toBe(401);
    });

    it('ya no existe el registro público de usuarios', async () => {
      const r = await nuevoCliente().pedir('POST', 'auth/registro', { nombre_completo: 'Nadie', ci: nuevoCi(), password: 'clave1234', confirmacion: 'clave1234' });
      expect(r.status).toBe(404);
    });
  });

  describe('límite de intentos', () => {
    it('bloquea el sexto intento tras 5 logins fallidos del mismo CI e IP, aunque sea correcto', async () => {
      const u = await crearUsuario('Admin Bloqueado', 'admin');
      for (let i = 1; i <= 5; i++) expect((await nuevoCliente().login(u.ci, `incorrecta${i}`)).status).toBe(401);

      const bloqueado = await nuevoCliente().login(u.ci, PASSWORD);
      expect(bloqueado.status).toBe(429);
      expect(bloqueado.body.error).toMatch(/Demasiados intentos/);
      expect(Number(bloqueado.headers.get('retry-after'))).toBeGreaterThan(0);

      // Otro CI desde la misma IP no queda bloqueado
      expect((await nuevoCliente().login(nuevoCi(), 'incorrecta1')).status).toBe(401);
    });

    it('además, 20 logins fallidos desde la misma IP (con CI distintos) bloquean cualquier login', async () => {
      // Una aplicación aparte: su contador no depende de los intentos de las demás pruebas
      const { crearApp } = await import('./app');
      const otro = crearApp().listen(0);
      await new Promise((resolve) => otro.once('listening', resolve));
      try {
        const cliente = () => new Cliente(() => `http://127.0.0.1:${(otro.address() as AddressInfo).port}`);
        // Cada CI falla una sola vez: el límite por CI + IP (5) no llega a actuar
        for (let i = 0; i < 20; i++) expect((await cliente().login(nuevoCi(), `incorrecta${i}`)).status).toBe(401);
        const bloqueado = await cliente().login(admin.ci, PASSWORD);
        expect(bloqueado.status).toBe(429);
        expect(bloqueado.body.error).toMatch(/Demasiados intentos/);
        expect(bloqueado.headers.get('set-cookie')).toBeNull();
      } finally {
        otro.close();
      }
      // 21 comparaciones bcrypt de costo 12
    }, 30_000);

    it('los logins exitosos no cuentan como intentos', async () => {
      const u = await crearUsuario('Admin Constante', 'admin');
      for (let i = 0; i < 6; i++) expect((await nuevoCliente().login(u.ci, PASSWORD)).status).toBe(200);
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
      const r = await nuevoCliente().pedir(metodo, ruta, metodo === 'GET' || metodo === 'DELETE' ? undefined : {});
      expect(r.status).toBe(401);
      expect(r.body.error).toBe('Debe iniciar sesión');
    });

    it('/api/health sigue siendo público', async () => {
      expect((await nuevoCliente().pedir('GET', 'health')).status).toBe(200);
    });

    it('con sesión de administrador se pueden leer los datos', async () => {
      const r = await clienteAdmin.pedir('GET', 'titulados');
      expect(r.status).toBe(200);
      expect(r.body.length).toBeGreaterThanOrEqual(184);
    });

    it('si un administrador pierde el rol, su sesión deja de ver los datos y la administración', async () => {
      const otro = await nuevoAdmin('Admin Degradado');
      expect((await otro.cliente.pedir('GET', 'titulados')).status).toBe(200);
      await clienteAdmin.pedir('PATCH', `admin/usuarios/${otro.id}`, { rol: 'usuario' });
      for (const [metodo, ruta] of protegidas.filter(([, ruta]) => ruta !== 'auth/yo')) {
        const r = await otro.cliente.pedir(metodo, ruta, metodo === 'GET' || metodo === 'DELETE' ? undefined : {});
        expect(r.status, `${metodo} ${ruta}`).toBe(403);
      }
    });

    it('las respuestas GET no se guardan en caché (con y sin sesión)', async () => {
      expect((await nuevoCliente().pedir('GET', 'titulados')).headers.get('cache-control')).toBe('no-store');
      for (const ruta of ['titulados', 'empleadores', 'items-empleadores', 'auth/yo']) {
        expect((await clienteAdmin.pedir('GET', ruta)).headers.get('cache-control')).toBe('no-store');
      }
    });
  });

  describe('encuestas públicas', () => {
    const contar = async () => Number((await pool.query('SELECT count(*) FROM titulados')).rows[0].count);

    it('cualquiera puede enviar la encuesta de titulados sin cuenta; se guarda como formulario', async () => {
      const antes = await contar();
      const r = await nuevoCliente().pedir('POST', 'publico/titulados', { ...TITULADO_VALIDO, [CAMPO_TRAMPA]: '' });
      expect(r.status).toBe(201);
      tituladosCreados.push(Number(r.body.id));
      expect(await contar()).toBe(antes + 1);
      const { rows } = await pool.query('SELECT origen FROM titulados WHERE id = $1', [r.body.id]);
      expect(rows[0].origen).toBe('formulario');
      expect(r.headers.get('set-cookie')).toBeNull();
    });

    it('aplica las mismas validaciones que el formulario', async () => {
      const r = await nuevoCliente().pedir('POST', 'publico/empleadores', { organizacion: '' });
      expect(r.status).toBe(400);
      expect(Object.keys(r.body.errores)).toEqual(expect.arrayContaining(['organizacion', 'tipo', 'tamano']));
    });

    it('con el campo trampa lleno responde como si guardara, pero no guarda nada', async () => {
      const antes = await contar();
      const r = await nuevoCliente().pedir('POST', 'publico/titulados', { ...TITULADO_VALIDO, [CAMPO_TRAMPA]: 'https://spam.example' });
      expect(r.status).toBe(201);
      expect(await contar()).toBe(antes);
    });

    it('limita los envíos por IP y por hora', async () => {
      // Una aplicación aparte con un límite bajo, para no depender del orden de las demás pruebas
      const anterior = process.env.LIMITE_ENCUESTAS_POR_HORA;
      process.env.LIMITE_ENCUESTAS_POR_HORA = '3';
      const { crearApp } = await import('./app');
      const otro = crearApp().listen(0);
      if (anterior === undefined) delete process.env.LIMITE_ENCUESTAS_POR_HORA;
      else process.env.LIMITE_ENCUESTAS_POR_HORA = anterior;
      await new Promise((resolve) => otro.once('listening', resolve));
      try {
        const c = new Cliente(() => `http://127.0.0.1:${(otro.address() as AddressInfo).port}`);
        // Los envíos inválidos también cuentan
        for (let i = 0; i < 3; i++) expect((await c.pedir('POST', 'publico/empleadores', {})).status).toBe(400);
        const bloqueado = await c.pedir('POST', 'publico/empleadores', {});
        expect(bloqueado.status).toBe(429);
        expect(bloqueado.body.error).toMatch(/límite de envíos/);
        // Cada encuesta tiene su propio contador
        expect((await c.pedir('POST', 'publico/titulados', {})).status).toBe(400);
      } finally {
        otro.close();
      }
    });
  });

  describe('administración', () => {
    it('lista usuarios con búsqueda por nombre o CI y paginación', async () => {
      const { ci } = await crearUsuario('Zacarías Buscable');
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
      const otro = await nuevoAdmin('Admin Gestionado');

      const degradado = await clienteAdmin.pedir('PATCH', `admin/usuarios/${otro.id}`, { rol: 'usuario' });
      expect(degradado.body).toMatchObject({ rol: 'usuario', activo: true });
      expect((await otro.cliente.pedir('GET', 'admin/resumen')).status).toBe(403); // el cambio rige de inmediato

      const promovido = await clienteAdmin.pedir('PATCH', `admin/usuarios/${otro.id}`, { rol: 'admin' });
      expect(promovido.body.rol).toBe('admin');
      expect((await otro.cliente.pedir('GET', 'admin/resumen')).status).toBe(200);

      const desactivado = await clienteAdmin.pedir('PATCH', `admin/usuarios/${otro.id}`, { activo: false });
      expect(desactivado.body).toMatchObject({ rol: 'admin', activo: false });
      expect((await otro.cliente.pedir('GET', 'auth/yo')).status).toBe(401);

      expect((await clienteAdmin.pedir('PATCH', `admin/usuarios/${otro.id}`, { activo: true })).body.activo).toBe(true);
      expect((await clienteAdmin.pedir('PATCH', `admin/usuarios/${otro.id}`, { rol: 'jefe' })).status).toBe(400);
      expect((await clienteAdmin.pedir('PATCH', `admin/usuarios/${otro.id}`, {})).status).toBe(400);
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
      const otro = await nuevoAdmin('Admin Eliminado');
      expect((await clienteAdmin.pedir('DELETE', `admin/usuarios/${otro.id}`)).status).toBe(200);
      expect((await otro.cliente.pedir('GET', 'auth/yo')).status).toBe(401);
      expect((await pool.query(`SELECT 1 FROM sesiones WHERE sess->>'usuarioId' = $1`, [String(otro.id)])).rowCount).toBe(0);
      expect((await clienteAdmin.pedir('DELETE', `admin/usuarios/${otro.id}`)).status).toBe(404);
    });

    it('resume usuarios, encuestas por origen y los últimos 7 días', async () => {
      const r = await clienteAdmin.pedir('GET', 'admin/resumen');
      expect(r.status).toBe(200);
      const { usuarios, titulados, empleadores, ultimos_7_dias } = r.body;
      expect(usuarios.admins).toBeGreaterThanOrEqual(1);
      expect(usuarios.total).toBeGreaterThanOrEqual(usuarios.activos);
      expect(titulados.base_oficial).toBe(184);
      expect(empleadores.base_oficial).toBe(78);
      expect(titulados.total).toBe(titulados.base_oficial + titulados.formulario);
      expect(ultimos_7_dias.por_dia).toHaveLength(7);
      expect(ultimos_7_dias.usuarios).toBeGreaterThanOrEqual(1); // los creados por estas pruebas
      const suma = ultimos_7_dias.por_dia.reduce((s: number, d: { titulados: number }) => s + d.titulados, 0);
      expect(suma).toBe(ultimos_7_dias.titulados);
    });
  });
});
