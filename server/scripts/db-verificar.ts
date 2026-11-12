/**
 * npm run db:verificar — comprueba que la base normalizada reproduce la base oficial de
 * public/data (los titulados del CSV y, lo que el CSV no traiga, del .xlsx; ver db:seed):
 *
 *   1. v_titulados y v_empleadores tienen tantos registros oficiales como los archivos.
 *   2. Esos registros son idénticos a los que el importador lee de los archivos.
 *   3. Los valores de control (hoja Resultados del exportador: HU1 a HU4, pruebas de
 *      independencia e índices de empleadores) son los mismos calculados desde la base
 *      o desde los archivos.
 */

import { isDeepStrictEqual } from 'node:util';
import { leerBaseRealLocal } from '../../src/utils/baseRealLocal';
import { filasResultados } from '../../src/utils/exportador';
import { pool } from '../db';
import { empleadorDeFila, tituladoDeFila } from '../repositorio';

const excel = await leerBaseRealLocal();
const ESPERADO = { titulados: excel.titulados?.length ?? 0, empleadores: excel.empleadores?.length ?? 0 };
for (const [parte, archivo] of Object.entries(excel.fuentes)) console.log(`      ${parte}: ${archivo}`);

let fallas = 0;
const comprobar = (descripcion: string, ok: boolean, detalle = '') => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${descripcion}${detalle ? ` — ${detalle}` : ''}`);
  if (!ok) fallas++;
};

try {
  const oficiales = `WHERE origen = 'base_oficial' ORDER BY id`;
  const titulados = (await pool.query(`SELECT * FROM v_titulados ${oficiales}`)).rows.map(tituladoDeFila);
  const empleadores = (await pool.query(`SELECT * FROM v_empleadores ${oficiales}`)).rows.map(empleadorDeFila);

  comprobar('v_titulados: registros oficiales', titulados.length === ESPERADO.titulados, `${titulados.length} de ${ESPERADO.titulados}`);
  comprobar('v_empleadores: registros oficiales', empleadores.length === ESPERADO.empleadores, `${empleadores.length} de ${ESPERADO.empleadores}`);

  // Se compara la forma JSON, que es la que entrega la API.
  const json = (x: unknown) => JSON.parse(JSON.stringify(x));
  comprobar('titulados idénticos a los archivos', isDeepStrictEqual(json(titulados), json(excel.titulados)));
  comprobar('empleadores idénticos a los archivos', isDeepStrictEqual(json(empleadores), json(excel.empleadores)));

  const control = filasResultados(titulados, empleadores);
  const controlExcel = filasResultados(excel.titulados ?? [], excel.empleadores ?? []);
  const distintos = control.filter((fila, i) => !isDeepStrictEqual(fila, controlExcel[i]));
  comprobar(
    'valores de control (hoja Resultados) iguales a los de los archivos',
    control.length === controlExcel.length && distintos.length === 0,
    `${control.length - 1} indicadores${distintos.length ? `, distintos: ${distintos.map((f) => f[1]).join('; ')}` : ''}`
  );

  const valor = (indicador: string) => control.find((f) => f[1] === indicador)?.[2];
  for (const indicador of [
    'Años de vida profesional: media',
    'Dos áreas principales (%)',
    'Nivel del programa × fuente de financiamiento: p oficial',
    'Índice: Participación del empleador en la mejora de la Carrera'
  ]) {
    console.log(`      ${indicador}: ${valor(indicador)}`);
  }
} catch (err) {
  console.error('No se pudo verificar:', err instanceof Error ? err.message : err);
  fallas++;
} finally {
  await pool.end();
}

process.exitCode = fallas > 0 ? 1 : 0;
