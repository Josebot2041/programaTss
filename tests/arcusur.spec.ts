/**
 * Pruebas de extremo a extremo de la web ARCU-SUR (Playwright): npm run test:e2e
 *
 * P8 · Autenticación: registro, login, logout, acceso denegado al panel para un usuario normal
 * y acceso al panel para un administrador.
 * P9 · Persistencia: una encuesta guardada sigue en la base al recargar y al volver a iniciar
 * sesión; un 401 lleva al login (nunca al Excel) y un 5xx al Excel de respaldo, indicado en el Header.
 *
 * Los usuarios de prueba tienen CI que empiezan con 94 y una contraseña generada al azar en cada
 * ejecución. Al terminar se borran (con sus sesiones), igual que las encuestas registradas.
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
const fuenteDatos = (page: Page) => page.getByTestId('fuente-datos');

async function contarTitulados(): Promise<number> {
  const { rows } = await pool.query<{ total: number }>('SELECT count(*)::int AS total FROM titulados');
  return rows[0].total;
}

test.afterAll(async () => {
  const { rows } = await pool.query<{ id: number }>('SELECT id FROM usuarios WHERE ci LIKE ANY ($1)', [cisCreados.map((ci) => `${ci}%`)]);
  const ids = rows.map((r) => String(r.id));
  await pool.query(`DELETE FROM sesiones WHERE sess->>'usuarioId' = ANY ($1)`, [ids]);
  await pool.query('DELETE FROM usuarios WHERE id = ANY ($1::int[])', [ids]);
  await pool.end();
});

test.describe('P8 · Autenticación', () => {
  test.describe.configure({ mode: 'serial' });

  let usuario: { nombre: string; ci: string };
  let admin: { nombre: string; ci: string };

  test.beforeAll(async () => {
    usuario = await crearUsuario('Usuaria De Prueba', 'usuario');
    admin = await crearUsuario('Administrador De Prueba', 'admin');
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

test.describe('P9 · Persistencia de las encuestas', () => {
  test.describe.configure({ mode: 'serial' });

  let usuario: { nombre: string; ci: string };
  const tituladosCreados: number[] = [];

  test.beforeAll(async () => {
    usuario = await crearUsuario('Encuestadora De Prueba', 'usuario');
  });

  test.afterAll(async () => {
    if (tituladosCreados.length === 0) return;
    await pool.query('DELETE FROM titulados WHERE id = ANY ($1::int[])', [tituladosCreados]);
    // La próxima encuesta real recibe el número que le correspondía
    await pool.query(`SELECT setval(pg_get_serial_sequence('titulados', 'id'), (SELECT max(id) FROM titulados))`);
  });

  test('P9.1 Una encuesta guardada sigue en la base al recargar y al volver a iniciar sesión', async ({ page }) => {
    // Con la base oficial (148 titulados), el contador pasa a 149
    const antes = await contarTitulados();
    await iniciarSesion(page, usuario.ci);
    await expect(fuenteDatos(page)).toContainText(`Base de datos · ${antes} titulados`);

    await page.goto('/#encuesta_titulados');
    await page.locator('#tit-edad').selectOption('23 - 26 años');
    await page.locator('#tit-genero').selectOption('Mujer');
    await page.locator('#tit-vida').fill('3');
    await page.locator('#tit-desempleo').fill('0');
    await page.locator('#tit-formacion_complementaria').selectOption('No');
    await page.locator('#tit-interes_posgrado').selectOption('No');
    await page.locator('#tit-situacion_laboral').selectOption('No trabaja');
    for (const pregunta of [/Satisfacción global/, /Concordancia entre/, /posgrados afines/]) {
      await page.getByRole('group', { name: pregunta }).getByRole('radio').nth(3).click();
    }
    const guardado = page.waitForResponse((r) => r.url().endsWith('/api/titulados') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Guardar encuesta' }).click();
    const respuesta = await guardado;
    expect(respuesta.status()).toBe(201);
    const { id } = (await respuesta.json()) as { id: string };
    tituladosCreados.push(Number(id));

    // El contador sale de los datos recargados desde la API y coincide con la base
    await expect(page.getByText(`Se registró la encuesta n.º ${id}`)).toBeVisible();
    await expect(fuenteDatos(page)).toContainText(`Base de datos · ${antes + 1} titulados`);
    expect(await contarTitulados()).toBe(antes + 1);

    // Al recargar la página la sesión sigue y el contador no vuelve al Excel
    await page.reload();
    await expect(fuenteDatos(page)).toContainText(`Base de datos · ${antes + 1} titulados`);

    // Sin la cookie (como al abrir la web otro día): login y otra vez los datos de la base
    await page.context().clearCookies();
    await iniciarSesion(page, usuario.ci);
    await expect(usuarioActual(page)).toContainText(usuario.nombre);
    await expect(fuenteDatos(page)).toContainText(`Base de datos · ${antes + 1} titulados`);
    await expect(page.getByText('Respaldo Excel')).toHaveCount(0);
  });

  test('P9.2 Un 401 al pedir los datos lleva al login, nunca al Excel', async ({ page }) => {
    await iniciarSesion(page, usuario.ci);
    await expect(fuenteDatos(page)).toContainText('Base de datos');

    const pedidosExcel: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('.xlsx')) pedidosExcel.push(r.url());
    });
    await page.route('**/api/titulados', (ruta) => ruta.fulfill({ status: 401, json: { error: 'Inicie sesión para continuar' } }));
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByText('Su sesión terminó')).toBeVisible();
    expect(pedidosExcel).toEqual([]);
  });

  test('P9.3 Con el servidor caído (5xx) usa el Excel de respaldo, lo indica y permite reintentar', async ({ page }) => {
    const total = await contarTitulados();
    await iniciarSesion(page, usuario.ci);
    await expect(fuenteDatos(page)).toContainText(`Base de datos · ${total} titulados`);

    await page.route('**/api/titulados', (ruta) => ruta.fulfill({ status: 502, json: { error: 'Bad Gateway' } }));
    await page.reload();
    await expect(fuenteDatos(page)).toContainText('Respaldo Excel (sin conexión)');
    await expect(page.getByText(/se muestran los datos de respaldo/)).toBeVisible();

    await page.unroute('**/api/titulados');
    await fuenteDatos(page).getByRole('button', { name: 'Reintentar' }).click();
    await expect(fuenteDatos(page)).toContainText(`Base de datos · ${total} titulados`);
    await expect(page.getByText(/se muestran los datos de respaldo/)).toHaveCount(0);
  });
});
