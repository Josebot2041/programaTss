/**
 * Pruebas de la importación de archivos (Base de datos → Importar) contra la base de .env.
 * Usan registros de prueba con Ids desde 990000 y usuarios con CI que empiezan con 96; todo se
 * borra al terminar. Si no hay base (DATABASE_URL y npm run db:init), se omiten.
 */
import 'dotenv/config';
import { randomBytes, randomInt } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import * as XLSX from 'xlsx';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Empleador, Titulado } from '../src/types';
import { filasEmpleadores, filasTitulados } from '../src/utils/exportador';

process.env.SESSION_SECRET ??= randomBytes(48).toString('base64url');

async function baseDisponible(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  const { pool } = await import('./db');
  return pool.query(`SELECT to_regclass('importaciones') IS NOT NULL AS ok`).then(
    (r) => r.rows[0].ok as boolean,
    () => false
  );
}
const hayBase = await baseDisponible();
if (!hayBase) console.warn('Pruebas de importación omitidas: sin base de datos (DATABASE_URL y npm run db:init).');

/** Ids de prueba: nunca chocan con la base oficial (1–184 / 1–80) ni con las encuestas de la web. */
const ID_BASE = 990000;
const cisCreados: string[] = [];

/** Libro .xlsx en el formato de la base limpia, con las hojas que se pasen. */
function libro(hojas: { titulados?: Titulado[]; empleadores?: Empleador[] }): Buffer {
  const wb = XLSX.utils.book_new();
  if (hojas.titulados) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filasTitulados(hojas.titulados)), 'Titulados');
  if (hojas.empleadores) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filasEmpleadores(hojas.empleadores)), 'Empleadores');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer;
}

/** Excel crudo de Microsoft Forms (titulados) con las columnas que la limpieza reconoce. */
function crudoTitulados(ids: number[]): Buffer {
  const fila = (valores: Record<number, string | number>) => Array.from({ length: 167 }, (_, i) => valores[i] ?? '');
  const filas = [
    fila({
      0: 'Id',
      8: 'Edad que tiene actualmente:',
      43: '¿CUÁNTOS SON LOS AÑOS DE VIDA PROFESIONAL QUE LLEVA HASTA LA FECHA?',
      49: '¿CUÁL DE LAS SIGUIENTES AFIRMACIONES DESCRIBE SU SITUACIÓN LABORAL ACTUAL?',
      155: '¿Le interesaría formar parte una red de contactos oficial de la Carrera?'
    }),
    ...ids.map((id) =>
      fila({ 0: id, 8: '23 - 26 años', 11: 'Mujer', 14: 'NO', 29: 'NO', 40: 'De acuerdo', 43: '2 años', 46: '6 meses', 49: 'Actualmente NO trabajo', 129: 'De acuerdo', 134: 'En desacuerdo', 155: 'SI' })
    )
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe.skipIf(!hayBase)('Importación de archivos', () => {
  let servidor: Server;
  let base = '';
  let pool: typeof import('./db').pool;
  let importacion: typeof import('./importacion');
  let repositorio: typeof import('./repositorio');
  let plantillaTitulado: Titulado;
  let plantillaEmpleador: Empleador;
  let cookieAdmin = '';
  let adminId = 0;
  const PASSWORD = 'Imp' + randomBytes(6).toString('hex') + '1';

  const url = (ruta: string) => `${base}/api/${ruta}`;
  const titulado = (id: number, cambios: Partial<Titulado> = {}): Titulado => ({ ...plantillaTitulado, ...cambios, id: String(ID_BASE + id) });
  const empleador = (id: number, cambios: Partial<Empleador> = {}): Empleador => ({ ...plantillaEmpleador, ...cambios, id: String(ID_BASE + id) });

  async function crearUsuario(rol: 'usuario' | 'admin') {
    const ci = `96${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
    cisCreados.push(ci);
    const { hashearPassword } = await import('./usuarios');
    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO usuarios (nombre_completo, ci, password_hash, rol) VALUES ('Importadora De Prueba', $1, $2, $3) RETURNING id`,
      [ci, await hashearPassword(PASSWORD), rol]
    );
    return { id: rows[0].id, ci };
  }

  async function login(ci: string): Promise<string> {
    const r = await fetch(url('auth/login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ci, password: PASSWORD }) });
    expect(r.status).toBe(200);
    return r.headers.get('set-cookie')!.split(';')[0];
  }

  async function previsualizar(archivo: Buffer | Blob, nombre: string, cookie = cookieAdmin) {
    const form = new FormData();
    form.append('archivo', archivo instanceof Blob ? archivo : new Blob([new Uint8Array(archivo)]), nombre);
    const r = await fetch(url('admin/importar/previsualizar'), { method: 'POST', headers: { cookie }, body: form });
    return { status: r.status, body: await r.json() };
  }

  async function confirmar(token: string, modo: string, cookie = cookieAdmin) {
    const r = await fetch(url('admin/importar/confirmar'), {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, modo })
    });
    return { status: r.status, body: await r.json() };
  }

  async function importar(archivo: Buffer, modo: string, nombre = 'prueba.xlsx') {
    const p = await previsualizar(archivo, nombre);
    expect(p.status).toBe(200);
    const c = await confirmar(p.body.token, modo);
    expect(c.status).toBe(200);
    return { previa: p.body, resultado: c.body };
  }

  async function fila(tabla: 'titulados' | 'empleadores', id: number) {
    const vista = tabla === 'titulados' ? 'v_titulados' : 'v_empleadores';
    const { rows } = await pool.query(`SELECT v.*, t.importacion_id FROM ${vista} v JOIN ${tabla} t USING (id) WHERE v.id = $1`, [ID_BASE + id]);
    return rows[0];
  }

  const conteos = async () =>
    (
      await pool.query(
        `SELECT (SELECT count(*) FROM titulados)::int AS titulados, (SELECT count(*) FROM empleadores)::int AS empleadores,
                (SELECT count(*) FROM importaciones)::int AS importaciones, (SELECT count(*) FROM titulado_actividad)::int AS actividades`
      )
    ).rows[0];

  beforeAll(async () => {
    ({ pool } = await import('./db'));
    importacion = await import('./importacion');
    repositorio = await import('./repositorio');
    const { crearApp } = await import('./app');
    servidor = crearApp().listen(0);
    await new Promise((resolve) => servidor.once('listening', resolve));
    base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

    // Registros reales como plantilla: así los de prueba son válidos por construcción
    plantillaTitulado = repositorio.tituladoDeFila((await pool.query(`SELECT * FROM v_titulados WHERE situacion_laboral = 'Trabaja en una organización' ORDER BY id LIMIT 1`)).rows[0]);
    plantillaEmpleador = repositorio.empleadorDeFila((await pool.query('SELECT * FROM v_empleadores ORDER BY id LIMIT 1')).rows[0]);

    const admin = await crearUsuario('admin');
    adminId = admin.id;
    cookieAdmin = await login(admin.ci);
  });

  afterAll(async () => {
    servidor?.close();
    if (!pool) return;
    await pool.query('DELETE FROM titulados WHERE id >= $1', [ID_BASE]);
    await pool.query('DELETE FROM empleadores WHERE id >= $1', [ID_BASE]);
    const { rows } = await pool.query<{ id: number }>('SELECT id FROM usuarios WHERE ci LIKE ANY ($1)', [cisCreados.map((ci) => `${ci}%`)]);
    const ids = rows.map((r) => r.id);
    await pool.query('DELETE FROM importaciones WHERE usuario_id = ANY ($1::int[])', [ids]);
    await pool.query(`DELETE FROM sesiones WHERE sess->>'usuarioId' = ANY ($1)`, [ids.map(String)]);
    await pool.query('DELETE FROM usuarios WHERE id = ANY ($1::int[])', [ids]);
    for (const tabla of ['titulados', 'empleadores']) {
      await pool.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM ${tabla}), false)`, [tabla]);
    }
    await pool.end();
  });

  describe('previsualizar', () => {
    it('no escribe nada en la base y describe lo que pasaría en cada modo', async () => {
      const antes = await conteos();
      const p = await previsualizar(libro({ titulados: [titulado(1), titulado(2)], empleadores: [empleador(1)] }), 'base limpia.xlsx');
      expect(p.status).toBe(200);
      expect(await conteos()).toEqual(antes);

      expect(p.body).toMatchObject({
        archivo: 'base limpia.xlsx',
        formato: 'base_limpia',
        cantidades: { titulados: 2, empleadores: 1 },
        estados: { titulados: { nuevo: 2, sin_cambios: 0, cambia: 0, protegido: 0 }, empleadores: { nuevo: 1 } },
        porModo: { agregar: { insertados: 3, actualizados: 0, omitidos: 0, eliminados: 0 } },
        totalProblemas: 0
      });
      expect(p.body.token).toMatch(/^[\w-]{20,}$/);
      expect(new Date(p.body.vence).getTime() - Date.now()).toBeGreaterThan(14 * 60 * 1000);
      expect(p.body.muestra.titulados.map((m: { estado: string }) => m.estado)).toEqual(['nuevo', 'nuevo']);
      expect(p.body.datos.titulados).toHaveLength(2);
    });

    it('reconoce y limpia el Excel crudo de Microsoft Forms', async () => {
      const p = await previsualizar(crudoTitulados([ID_BASE + 50, ID_BASE + 51]), 'ENCUESTA_DE_OPINION.xlsx');
      expect(p.status).toBe(200);
      expect(p.body.formato).toBe('titulados_crudo');
      expect(p.body.estados.titulados.nuevo).toBe(2);
      expect(p.body.datos.titulados[0]).toMatchObject({ edad: '23 - 26 años', anios_vida_profesional: 2, anios_desempleado: 0.5, situacion_laboral: 'No trabaja' });
      // Las conversiones de la limpieza se informan como advertencias
      expect(p.body.problemas).toContainEqual(expect.objectContaining({ columna: 'anios_desempleado', valor: '6 meses', severidad: 'advertencia' }));
    });

    it('rechaza archivos que no son .xlsx o .csv, de más de 10 MB o sin un formato conocido', async () => {
      expect(await previsualizar(Buffer.from('hola'), 'notas.txt')).toEqual({ status: 400, body: { error: 'Solo se aceptan archivos .xlsx o .csv.' } });
      const grande = await previsualizar(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]), 'grande.csv');
      expect(grande.status).toBe(413);
      const desconocido = await previsualizar(Buffer.from('a;b\n1;2\n'), 'otra cosa.csv');
      expect(desconocido.status).toBe(400);
      expect(desconocido.body.error).toMatch(/No se reconoce el formato/);
      const sinArchivo = await fetch(url('admin/importar/previsualizar'), { method: 'POST', headers: { cookie: cookieAdmin } });
      expect(sinArchivo.status).toBe(400);
    });
  });

  describe('confirmar', () => {
    it('agregar solo inserta los Ids nuevos y no toca los existentes', async () => {
      const primera = await importar(libro({ titulados: [titulado(10), titulado(11)] }), 'agregar');
      expect(primera.resultado).toMatchObject({ modo: 'agregar', insertados: 2, actualizados: 0, omitidos: 0 });
      expect(await fila('titulados', 10)).toMatchObject({ origen: 'importacion', importacion_id: primera.resultado.id });

      const segunda = await importar(libro({ titulados: [titulado(10, { programa: 'Cambiado' }), titulado(12)] }), 'agregar');
      expect(segunda.resultado).toMatchObject({ insertados: 1, actualizados: 0, omitidos: 1 });
      expect((await fila('titulados', 10)).programa).toBe(plantillaTitulado.programa ?? null);
      expect(await fila('titulados', 12)).toBeDefined();
    });

    it('actualizar inserta los nuevos y actualiza los existentes con el mismo Id (conserva la fecha de creación)', async () => {
      await importar(libro({ titulados: [titulado(20)] }), 'agregar');
      const creado = (await fila('titulados', 20)).created_at;

      const { previa, resultado } = await importar(
        libro({ titulados: [titulado(20, { programa: 'Maestría actualizada', actividades: ['Administración'] }), titulado(21)] }),
        'actualizar'
      );
      expect(previa.estados.titulados).toMatchObject({ cambia: 1, nuevo: 1 });
      expect(resultado).toMatchObject({ insertados: 1, actualizados: 1, omitidos: 0 });
      const actualizado = await fila('titulados', 20);
      expect(actualizado).toMatchObject({ programa: 'Maestría actualizada', actividades: ['Administración'], importacion_id: resultado.id });
      expect(actualizado.created_at).toEqual(creado);
    });

    it('agregar y actualizar nunca modifican las encuestas guardadas desde la web (origen formulario)', async () => {
      const cliente = await pool.connect();
      try {
        await repositorio.insertarTitulado(cliente, await repositorio.leerIds(cliente), titulado(30), { origen: 'formulario', id: ID_BASE + 30 });
      } finally {
        cliente.release();
      }
      // reemplazar_oficial se prueba aparte: con un archivo parcial quitaría la base oficial real
      for (const modo of ['agregar', 'actualizar']) {
        const { previa, resultado } = await importar(libro({ titulados: [titulado(30, { programa: 'No debe guardarse' })] }), modo);
        expect(previa.estados.titulados.protegido).toBe(1);
        expect(resultado).toMatchObject({ insertados: 0, actualizados: 0, omitidos: 1 });
      }
      expect(await fila('titulados', 30)).toMatchObject({ origen: 'formulario', importacion_id: null, programa: plantillaTitulado.programa ?? null });
    });

    it('reemplazar_oficial reemplaza la base oficial, sin tocar los formularios ni las tablas que el archivo no trae', async () => {
      // Un oficial de prueba que no estará en el archivo, y una encuesta de la web tampoco incluida
      const cliente = await pool.connect();
      try {
        const ids = await repositorio.leerIds(cliente);
        await repositorio.insertarTitulado(cliente, ids, titulado(40), { origen: 'base_oficial', id: ID_BASE + 40 });
        await repositorio.insertarTitulado(cliente, ids, titulado(41), { origen: 'formulario', id: ID_BASE + 41 });
      } finally {
        cliente.release();
      }
      // El archivo trae toda la base oficial real (sin cambios) y un oficial de prueba modificado
      const oficiales = (await pool.query(`SELECT * FROM v_titulados WHERE origen = 'base_oficial' AND id < $1 ORDER BY id`, [ID_BASE])).rows.map(repositorio.tituladoDeFila);
      const empleadoresAntes = (await conteos()).empleadores;

      const { previa, resultado } = await importar(
        libro({ titulados: [...oficiales, titulado(42), titulado(30, { programa: 'No debe guardarse' })] }),
        'reemplazar_oficial'
      );
      expect(previa.porModo.agregar.eliminados).toBe(0);
      expect(previa.estados.titulados.protegido).toBe(1);
      expect(resultado).toMatchObject({ insertados: 1, actualizados: 0, eliminados: 1, omitidos: oficiales.length + 1 });
      expect(await fila('titulados', 40)).toBeUndefined(); // oficial que no estaba en el archivo
      expect(await fila('titulados', 41)).toMatchObject({ origen: 'formulario' }); // de la web, fuera del archivo
      expect(await fila('titulados', 30)).toMatchObject({ origen: 'formulario', programa: plantillaTitulado.programa ?? null }); // de la web, en el archivo
      expect((await conteos()).empleadores).toBe(empleadoresAntes); // el archivo no traía empleadores
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM titulados WHERE origen = 'base_oficial' AND id < $1`, [ID_BASE]);
      expect(rows[0].n).toBe(oficiales.length);
    });

    it('un error a mitad de camino no deja filas parciales ni la importación', async () => {
      const antes = await conteos();
      const p = await previsualizar(libro({ titulados: [titulado(60), titulado(61), titulado(62)] }), 'con error.xlsx');
      expect(await importacion.obtenerPrevisualizacion(pool, p.body.token, adminId + 1)).toBeUndefined(); // otro usuario no la ve
      expect(await importacion.obtenerPrevisualizacion(pool, p.body.token, adminId)).toBeDefined();
      // Se corrompe el tercer registro después de la previsualización: falla al insertarlo,
      // cuando los dos primeros ya se insertaron dentro de la transacción
      await pool.query(`UPDATE importaciones_pendientes SET datos = jsonb_set(datos, '{titulados,2,edad}', '"Edad inválida"') WHERE token = $1`, [p.body.token]);

      const c = await confirmar(p.body.token, 'agregar');
      expect(c.status).toBe(500);
      expect(c.body.error).toMatch(/no se guardó ningún registro/);
      expect(await conteos()).toEqual(antes);
      expect(await fila('titulados', 60)).toBeUndefined();
      // La previsualización sigue pendiente (se descarta solo al guardar)
      expect(await importacion.obtenerPrevisualizacion(pool, p.body.token, adminId)).toBeDefined();
    });

    it('las previsualizaciones se guardan en importaciones_pendientes y las vencidas se borran', async () => {
      const p = await previsualizar(libro({ titulados: [titulado(65)] }), 'pendiente.xlsx');
      const { rows } = await pool.query(
        `SELECT usuario_id, archivo, jsonb_array_length(datos->'titulados') AS titulados, expira_en - created_at AS vigencia
         FROM importaciones_pendientes WHERE token = $1`,
        [p.body.token]
      );
      expect(rows[0]).toMatchObject({ usuario_id: adminId, archivo: 'pendiente.xlsx', titulados: 1 });
      expect(rows[0].vigencia).toMatchObject({ minutes: 15 });

      // Una previsualización vencida no se puede confirmar y se borra de la tabla
      await pool.query(`UPDATE importaciones_pendientes SET expira_en = now() - interval '1 minute' WHERE token = $1`, [p.body.token]);
      expect((await confirmar(p.body.token, 'agregar')).status).toBe(410);
      expect((await pool.query('SELECT 1 FROM importaciones_pendientes WHERE token = $1', [p.body.token])).rowCount).toBe(0);
      expect(await fila('titulados', 65)).toBeUndefined();
    });

    it('rechaza un token vencido o inexistente y un modo inválido', async () => {
      expect((await confirmar('no-existe', 'agregar')).status).toBe(410);
      const p = await previsualizar(libro({ titulados: [titulado(70)] }), 'x.xlsx');
      expect((await confirmar(p.body.token, 'borrar_todo')).status).toBe(400);
      // Un token ya usado no sirve dos veces
      expect((await confirmar(p.body.token, 'agregar')).status).toBe(200);
      expect((await confirmar(p.body.token, 'agregar')).status).toBe(410);
    });

    it('el historial registra quién importó, el archivo, el modo y las cantidades', async () => {
      await importar(libro({ empleadores: [empleador(80)] }), 'agregar', 'empleadores nuevos.xlsx');
      const r = await fetch(url('admin/importaciones'), { headers: { cookie: cookieAdmin } });
      expect(r.status).toBe(200);
      const [ultima] = await r.json();
      expect(ultima).toMatchObject({ archivo: 'empleadores nuevos.xlsx', modo: 'agregar', insertados: 1, actualizados: 0, omitidos: 0, eliminados: 0, usuario: 'Importadora De Prueba' });
      expect(await fila('empleadores', 80)).toMatchObject({ origen: 'importacion', organizacion: plantillaEmpleador.organizacion });
    });
  });

  describe('acceso', () => {
    it('sin sesión responde 401 y un usuario sin rol admin, 403', async () => {
      expect((await previsualizar(libro({ titulados: [titulado(90)] }), 'x.xlsx', '')).status).toBe(401);
      // Un administrador degradado conserva la sesión, pero ya no puede importar
      const otro = await crearUsuario('admin');
      const cookie = await login(otro.ci);
      const p = await previsualizar(libro({ titulados: [titulado(90)] }), 'x.xlsx', cookie);
      expect(p.status).toBe(200);
      await pool.query(`UPDATE usuarios SET rol = 'usuario' WHERE id = $1`, [otro.id]);
      expect((await previsualizar(libro({ titulados: [titulado(90)] }), 'x.xlsx', cookie)).status).toBe(403);
      expect((await confirmar(p.body.token, 'agregar', cookie)).status).toBe(403);
      expect((await fetch(url('admin/importaciones'), { headers: { cookie } })).status).toBe(403);
      expect(await fila('titulados', 90)).toBeUndefined();
    });
  });
});
