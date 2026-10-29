/**
 * Pruebas de extremo a extremo de la web ARCU-SUR (Playwright): npm run test:e2e
 *
 * P8 · Autenticación: registro, login, logout, acceso denegado al panel para un usuario normal
 * y acceso al panel para un administrador. Los usuarios de prueba tienen CI que empiezan con 94,
 * una contraseña generada al azar en cada ejecución, y se borran (con sus sesiones) al terminar.
 */
import 'dotenv/config';
import { randomBytes, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { expect, test, type Page } from '@playwright/test';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const PASSWORD = `E2e${randomBytes(6).toString('hex')}9`;
const cisCreados: string[] = [];

function nuevoCi(): string {
  const ci = `94${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
  cisCreados.push(ci);
  return ci;
}

async function crearUsuario(nombre: string, rol: 'usuario' | 'admin') {
  const ci = nuevoCi();
  await pool.query('INSERT INTO usuarios (nombre_completo, ci, password_hash, rol) VALUES ($1, $2, $3, $4)', [
    nombre,
    ci,
    await bcrypt.hash(PASSWORD, 12),
    rol
  ]);
  return { nombre, ci };
}

async function iniciarSesion(page: Page, ci: string, password = PASSWORD) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await page.locator('#ci').fill(ci);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
}

const usuarioActual = (page: Page) => page.getByTestId('usuario-actual');
const menu = (page: Page) => page.getByRole('navigation', { name: 'Secciones' });

test.describe('P8 · Autenticación', () => {
  test.describe.configure({ mode: 'serial' });

  let usuario: { nombre: string; ci: string };
  let admin: { nombre: string; ci: string };

  test.beforeAll(async () => {
    usuario = await crearUsuario('Usuaria De Prueba', 'usuario');
    admin = await crearUsuario('Administrador De Prueba', 'admin');
  });

  test.afterAll(async () => {
    const { rows } = await pool.query<{ id: number }>('SELECT id FROM usuarios WHERE ci LIKE ANY ($1)', [cisCreados.map((ci) => `${ci}%`)]);
    const ids = rows.map((r) => String(r.id));
    await pool.query(`DELETE FROM sesiones WHERE sess->>'usuarioId' = ANY ($1)`, [ids]);
    await pool.query('DELETE FROM usuarios WHERE id = ANY ($1::int[])', [ids]);
    await pool.end();
  });

  test('P8.1 Registro: valida el formulario, crea la cuenta y entra como usuario', async ({ page }) => {
    const ci = nuevoCi();
    await page.goto('/');
    // Sin sesión solo se ve el acceso
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(menu(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
    await page.locator('#nombre_completo').fill('Registro De Prueba');
    await page.locator('#ci').fill(`${ci} lp`);
    await page.locator('#password').fill('sinnumeros');
    await page.locator('#confirmacion').fill('otracosa1');
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await expect(page.getByText('La contraseña debe tener al menos una letra y un número')).toBeVisible();
    await expect(page.getByText('Las contraseñas no coinciden')).toBeVisible();

    await page.locator('#password').fill(PASSWORD);
    await page.locator('#confirmacion').fill(PASSWORD);
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();

    await expect(usuarioActual(page)).toContainText('Registro De Prueba');
    await expect(usuarioActual(page)).toContainText('Usuario');
    await expect(menu(page).getByText('Administración')).toHaveCount(0);
    const { rows } = await pool.query('SELECT ci, rol FROM usuarios WHERE ci = $1', [`${ci} LP`]);
    expect(rows).toEqual([{ ci: `${ci} LP`, rol: 'usuario' }]);
  });

  test('P8.2 Login: rechaza datos incorrectos y entra con los correctos', async ({ page }) => {
    await iniciarSesion(page, usuario.ci, 'Incorrecta123');
    await expect(page.getByRole('alert')).toHaveText('CI o contraseña incorrectos');

    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();

    await expect(usuarioActual(page)).toContainText(usuario.nombre);
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Análisis de mercado de Ingeniería de Sistemas' })).toBeVisible();
  });

  test('P8.3 Logout: cierra la sesión y vuelve al login', async ({ page }) => {
    await iniciarSesion(page, usuario.ci);
    await expect(usuarioActual(page)).toContainText(usuario.nombre);

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    expect((await page.request.get('/api/auth/yo')).status()).toBe(401);
    expect((await page.request.get('/api/titulados')).status()).toBe(401);
  });

  test('P8.4 Usuario normal: no puede abrir el panel de administración', async ({ page }) => {
    await iniciarSesion(page, usuario.ci);
    await expect(usuarioActual(page)).toContainText(usuario.nombre);
    await expect(menu(page).getByText('Administración')).toHaveCount(0);

    await page.goto('/#admin');
    await expect(page.getByRole('alert')).toContainText('No tiene permisos');
    await expect(page).toHaveURL(/#overview$/);
    await expect(page.getByRole('heading', { name: 'Análisis de mercado de Ingeniería de Sistemas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Panel de control' })).toHaveCount(0);

    // La API también lo impide
    expect((await page.request.get('/api/admin/resumen')).status()).toBe(403);
    expect((await page.request.get('/api/admin/usuarios')).status()).toBe(403);
  });

  test('P8.5 Administrador: accede al panel de control y a la gestión de usuarios', async ({ page }) => {
    await iniciarSesion(page, admin.ci);
    await expect(usuarioActual(page)).toContainText('Administrador');
    await expect(menu(page).getByText('Administración')).toBeVisible();

    await menu(page).getByRole('button', { name: 'Panel de control' }).click();
    await expect(page.getByRole('heading', { name: 'Panel de control' })).toBeVisible();
    await expect(page.getByText('Últimos 7 días', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Encuestas registradas por día' })).toBeVisible();

    await menu(page).getByRole('button', { name: 'Usuarios' }).click();
    await page.getByRole('searchbox', { name: 'Buscar por nombre o CI' }).fill(usuario.ci);
    const fila = page.getByRole('row', { name: new RegExp(usuario.nombre) });
    await expect(fila).toBeVisible();
    await expect(fila.getByRole('button', { name: 'Hacer admin' })).toBeEnabled();

    // Su propia fila no tiene acciones
    await page.getByRole('searchbox', { name: 'Buscar por nombre o CI' }).fill(admin.ci);
    await expect(page.getByRole('row', { name: /\(usted\)/ }).getByRole('button', { name: 'Eliminar' })).toBeDisabled();

    // Un enlace directo a #admin también funciona para el administrador
    await page.goto('/#admin');
    await expect(page.getByRole('heading', { name: 'Panel de control' })).toBeVisible();
  });
});
