/**
 * Pruebas de extremo a extremo de la web ARCU-SUR (Playwright): npm run test:e2e
 *
 * P8 · Portada y acceso: la portada pública con sus 3 tarjetas, el panel sin sesión redirige al
 * login, un usuario sin rol admin no entra y el administrador ve el dashboard (sin los botones
 * de encuesta en el Sidebar).
 * P9 · Encuestas públicas: una encuesta enviada sin cuenta aumenta el contador del panel; un 401
 * lleva al login (nunca al Excel) y un 5xx al Excel de respaldo, indicado en el Header.
 *
 * Los usuarios de prueba tienen CI que empiezan con 94 y una contraseña generada al azar en cada
 * ejecución. Al terminar se borran (con sus sesiones), igual que las encuestas enviadas.
 */
import 'dotenv/config';
import { randomBytes, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { expect, test, type Page } from '@playwright/test';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const PASSWORD = `E2e${randomBytes(6).toString('hex')}9`;
const cisCreados: string[] = [];
const tituladosCreados: number[] = [];

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

async function contarTitulados(): Promise<number> {
  const { rows } = await pool.query<{ total: number }>('SELECT count(*)::int AS total FROM titulados');
  return rows[0].total;
}

/** Completa el login de administrador (la página ya debe mostrar «Acceso administrador»). */
async function ingresar(page: Page, ci: string, password = PASSWORD) {
  await expect(page.getByRole('heading', { name: 'Acceso administrador' })).toBeVisible();
  await page.locator('#ci').fill(ci);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
}

async function iniciarSesion(page: Page, ci: string) {
  await page.goto('/#admin-login');
  await ingresar(page, ci);
  await expect(usuarioActual(page)).toBeVisible();
}

const usuarioActual = (page: Page) => page.getByTestId('usuario-actual');
const menu = (page: Page) => page.getByRole('navigation', { name: 'Secciones' });
const fuenteDatos = (page: Page) => page.getByTestId('fuente-datos');

test.afterAll(async () => {
  const { rows } = await pool.query<{ id: number }>('SELECT id FROM usuarios WHERE ci LIKE ANY ($1)', [cisCreados.map((ci) => `${ci}%`)]);
  const ids = rows.map((r) => String(r.id));
  await pool.query(`DELETE FROM sesiones WHERE sess->>'usuarioId' = ANY ($1)`, [ids]);
  await pool.query('DELETE FROM usuarios WHERE id = ANY ($1::int[])', [ids]);
  if (tituladosCreados.length > 0) {
    await pool.query('DELETE FROM titulados WHERE id = ANY ($1::int[])', [tituladosCreados]);
    // La próxima encuesta real recibe el número que le correspondía
    await pool.query(`SELECT setval(pg_get_serial_sequence('titulados', 'id'), (SELECT max(id) FROM titulados))`);
  }
  await pool.end();
});

test.describe('P8 · Portada y acceso de administrador', () => {
  test.describe.configure({ mode: 'serial' });

  let usuario: { nombre: string; ci: string };
  let admin: { nombre: string; ci: string };

  test.beforeAll(async () => {
    usuario = await crearUsuario('Usuaria De Prueba', 'usuario');
    admin = await crearUsuario('Administrador De Prueba', 'admin');
  });

  test('P8.1 La portada pública muestra el título y 3 tarjetas que llevan a cada página', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sistema de Análisis de Mercado y Empleabilidad');
    await expect(page.getByText('Ingeniería de Sistemas — Universidad Mayor de San Simón')).toBeVisible();
    await expect(page.getByText('Herramienta de recolección y análisis para el proceso de acreditación ARCU-SUR')).toBeVisible();
    const tarjetas = page.getByRole('list', { name: 'Opciones de acceso' }).getByRole('listitem');
    await expect(tarjetas).toHaveCount(3);
    await expect(tarjetas.getByRole('heading')).toHaveText(['Soy titulado', 'Soy empleador', 'Administrador']);
    await expect(page.getByText('Universidad Mayor de San Simón — Facultad de Ciencias y Tecnología')).toBeVisible();
    // Sin sesión no se ve el panel
    await expect(menu(page)).toHaveCount(0);

    await tarjetas.nth(1).getByRole('link', { name: 'Llenar encuesta' }).click();
    await expect(page).toHaveURL(/#encuesta-empleadores$/);
    await expect(page.getByText('1. Datos de la organización')).toBeVisible();
    await page.getByRole('link', { name: 'Volver al inicio' }).click();
    await tarjetas.nth(2).getByRole('link', { name: 'Entrar al panel' }).click();
    await expect(page).toHaveURL(/#admin-login$/);
    await expect(page.getByRole('heading', { name: 'Acceso administrador' })).toBeVisible();
  });

  test('P8.2 Sin sesión, una ruta del panel redirige al login y después abre esa sección', async ({ page }) => {
    await page.goto('/#panel/mercado');
    await expect(page).toHaveURL(/#admin-login$/);
    expect((await page.request.get('/api/titulados')).status()).toBe(401);

    await ingresar(page, admin.ci, 'Incorrecta123');
    await expect(page.getByRole('alert')).toHaveText('CI o contraseña incorrectos');
    await ingresar(page, admin.ci);
    await expect(page).toHaveURL(/#panel\/mercado$/);
    await expect(menu(page).getByRole('button', { name: 'Mercado laboral' })).toHaveAttribute('aria-current', 'page');
  });

  test('P8.3 Un usuario sin rol admin no entra al panel', async ({ page }) => {
    await page.goto('/#admin-login');
    await ingresar(page, usuario.ci);
    await expect(page.getByRole('alert')).toHaveText('No tiene permisos de administrador');
    await expect(page).toHaveURL(/#admin-login$/);
    await expect(menu(page)).toHaveCount(0);
    expect((await page.request.get('/api/auth/yo')).status()).toBe(401);
    expect((await page.request.get('/api/titulados')).status()).toBe(401);
  });

  test('P8.4 El administrador entra al dashboard; el Sidebar ya no tiene las encuestas', async ({ page }) => {
    await iniciarSesion(page, admin.ci);
    await expect(page).toHaveURL(/#panel\/overview$/);
    await expect(usuarioActual(page)).toContainText(admin.nombre);
    await expect(usuarioActual(page)).toContainText('Administrador');
    await expect(page.getByRole('heading', { name: 'Análisis de mercado de Ingeniería de Sistemas' })).toBeVisible();

    await expect(menu(page).getByRole('button', { name: 'Encuesta a titulados' })).toHaveCount(0);
    await expect(menu(page).getByRole('button', { name: 'Encuesta a empleadores' })).toHaveCount(0);
    await expect(menu(page).getByRole('button', { name: 'Base de datos' })).toBeVisible();

    await menu(page).getByRole('button', { name: 'Panel de control' }).click();
    await expect(page.getByRole('heading', { name: 'Panel de control' })).toBeVisible();
    await menu(page).getByRole('button', { name: 'Usuarios' }).click();
    await page.getByRole('searchbox', { name: 'Buscar por nombre o CI' }).fill(admin.ci);
    await expect(page.getByRole('row', { name: /\(usted\)/ }).getByRole('button', { name: 'Eliminar' })).toBeDisabled();

    await page.getByRole('link', { name: 'Ver portada pública' }).click();
    await expect(page.getByRole('heading', { name: 'Sistema de Análisis de Mercado y Empleabilidad' })).toBeVisible();
    // La sesión sigue: «Entrar al panel» abre el panel sin pedir la contraseña
    await page.getByRole('link', { name: 'Entrar al panel' }).click();
    await expect(usuarioActual(page)).toContainText(admin.nombre);
  });

  test('P8.5 Cerrar sesión vuelve a la portada y el panel vuelve a pedir el login', async ({ page }) => {
    await iniciarSesion(page, admin.ci);
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('heading', { name: 'Sistema de Análisis de Mercado y Empleabilidad' })).toBeVisible();
    await page.goto('/#panel/titulados');
    await expect(page).toHaveURL(/#admin-login$/);
    expect((await page.request.get('/api/auth/yo')).status()).toBe(401);
  });
});

test.describe('P9 · Encuestas públicas', () => {
  test.describe.configure({ mode: 'serial' });

  let admin: { nombre: string; ci: string };

  test.beforeAll(async () => {
    admin = await crearUsuario('Revisora De Prueba', 'admin');
  });

  test('P9.1 Una encuesta de titulado enviada sin cuenta aumenta el contador del panel', async ({ page }) => {
    const antes = await contarTitulados();

    await page.goto('/');
    await page.getByRole('link', { name: 'Llenar encuesta' }).first().click();
    await expect(page.getByRole('heading', { name: /Encuesta de opinión a titulados/ })).toBeVisible();
    // Las validaciones siguen activas
    await page.getByRole('button', { name: 'Enviar encuesta' }).click();
    await expect(page.getByText(/Revise los \d+ campos marcados/)).toBeVisible();

    await page.locator('#tit-edad').selectOption('23 - 26 años');
    await page.locator('#tit-genero').selectOption('Mujer');
    await page.locator('#tit-formacion_complementaria').selectOption('No');
    await page.locator('#tit-interes_posgrado').selectOption('No');
    await page.locator('#tit-vida').fill('3');
    await page.locator('#tit-desempleo').fill('0');
    await page.locator('#tit-situacion_laboral').selectOption('No trabaja');
    for (const pregunta of [/posgrados afines/, /Satisfacción global/, /Concordancia entre/]) {
      await page.getByRole('group', { name: pregunta }).getByRole('radio').nth(3).click();
    }
    const guardado = page.waitForResponse((r) => r.url().endsWith('/api/publico/titulados') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Enviar encuesta' }).click();
    const respuesta = await guardado;
    expect(respuesta.status()).toBe(201);
    const { id } = (await respuesta.json()) as { id: string };
    tituladosCreados.push(Number(id));

    await expect(page.getByRole('heading', { name: '¡Gracias por responder la encuesta!' })).toBeVisible();
    expect(await contarTitulados()).toBe(antes + 1);
    const { rows } = await pool.query('SELECT origen FROM titulados WHERE id = $1', [id]);
    expect(rows[0].origen).toBe('formulario');

    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(page.getByRole('heading', { name: 'Sistema de Análisis de Mercado y Empleabilidad' })).toBeVisible();

    // El panel muestra el contador de la base, que ya incluye la encuesta
    await iniciarSesion(page, admin.ci);
    await expect(fuenteDatos(page)).toContainText(`Base de datos · ${antes + 1} titulados`);
  });

  test('P9.2 Un 401 al pedir los datos lleva al login, nunca al Excel', async ({ page }) => {
    await iniciarSesion(page, admin.ci);
    await expect(fuenteDatos(page)).toContainText('Base de datos');

    const pedidosExcel: string[] = [];
    page.on('request', (r) => {
      if (/\.(xlsx|csv)$/.test(r.url())) pedidosExcel.push(r.url());
    });
    await page.route('**/api/titulados', (ruta) => ruta.fulfill({ status: 401, json: { error: 'Debe iniciar sesión' } }));
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Acceso administrador' })).toBeVisible();
    await expect(page.getByText('Su sesión terminó')).toBeVisible();
    expect(pedidosExcel).toEqual([]);
  });

  test('P9.3 Con el servidor caído (5xx) usa el Excel de respaldo, lo indica y permite reintentar', async ({ page }) => {
    const total = await contarTitulados();
    await iniciarSesion(page, admin.ci);
    await expect(fuenteDatos(page)).toContainText(`Base de datos · ${total} titulados`);

    await page.route('**/api/titulados', (ruta) => ruta.fulfill({ status: 502, json: { error: 'Bad Gateway' } }));
    await page.reload();
    await expect(fuenteDatos(page)).toContainText('Respaldo Excel (sin conexión)');
    await expect(page.getByText('se muestran los datos de respaldo de Base_Limpia_Titulados_Empleadores.xlsx')).toBeVisible();

    await page.unroute('**/api/titulados');
    await fuenteDatos(page).getByRole('button', { name: 'Reintentar' }).click();
    await expect(fuenteDatos(page)).toContainText(`Base de datos · ${total} titulados`);
    await expect(page.getByText(/se muestran los datos de respaldo/)).toHaveCount(0);
  });
});
