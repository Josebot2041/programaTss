/**
 * Las restricciones CHECK (columna IN (…)) de db/schema.sql repiten valores de
 * src/data/catalogos.ts. Esta prueba falla si ambos dejan de coincidir.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ANTIGUEDADES,
  DEPARTAMENTOS,
  EDADES,
  ENTREGABLES_NEGOCIO,
  GENEROS,
  IMPORTANCIAS_FORMACION,
  MEDIOS_CONVOCATORIA,
  MEDIOS_OBTENCION,
  NIVELES_DEMANDADOS,
  NUMERO_EMPLEOS,
  ORIGENES_EMPRENDIMIENTO,
  POSIBILIDADES_CONTRATACION,
  RAZONES_NO_TRABAJA,
  REMUNERACIONES,
  SATISFACCIONES_NEGOCIO,
  SI_NO,
  SITUACIONES_LABORALES,
  TAMANOS_EMPRESA,
  TIEMPOS_PRIMER_EMPLEO
} from '../src/data/catalogos';

const esquema = readFileSync(resolve(import.meta.dirname, '../db/schema.sql'), 'utf8');

const DOMINIOS: Record<string, readonly string[]> = {
  edad: EDADES,
  genero: GENEROS,
  formacion_complementaria: SI_NO,
  interes_posgrado: SI_NO,
  situacion_laboral: SITUACIONES_LABORALES,
  departamento: DEPARTAMENTOS,
  antiguedad_trabajo: ANTIGUEDADES,
  medio_obtencion: MEDIOS_OBTENCION,
  remuneracion: REMUNERACIONES,
  origen_emprendimiento: ORIGENES_EMPRENDIMIENTO,
  entregable_negocio: ENTREGABLES_NEGOCIO,
  satisfaccion_negocio: SATISFACCIONES_NEGOCIO,
  importancia_formacion_negocio: IMPORTANCIAS_FORMACION,
  primer_empleo: SI_NO,
  razon_no_trabaja: RAZONES_NO_TRABAJA,
  trabajo_previo_sistemas: SI_NO,
  tiempo_primer_empleo: TIEMPOS_PRIMER_EMPLEO,
  numero_empleos: NUMERO_EMPLEOS,
  red_contactos: SI_NO,
  tamano: TAMANOS_EMPRESA,
  contrato_5_anios: SI_NO,
  posibilidad_contratacion: POSIBILIDADES_CONTRATACION,
  nivel_demandado: NIVELES_DEMANDADOS,
  medio_convocatoria: MEDIOS_CONVOCATORIA
};

/** Valores de cada CHECK (columna IN ('a', 'b', …)) del esquema, por columna. */
function dominiosDelEsquema(): Map<string, string[]> {
  const dominios = new Map<string, string[]>();
  for (const [, columna, lista] of esquema.matchAll(/CHECK \((\w+) IN \(((?:'(?:[^']|'')*'(?:, )?)+)\)\)/g)) {
    dominios.set(columna, [...lista.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'")));
  }
  return dominios;
}

describe('db/schema.sql', () => {
  const dominios = dominiosDelEsquema();

  it.each(Object.entries(DOMINIOS))('CHECK de %s coincide con el catálogo', (columna, catalogo) => {
    expect(dominios.get(columna)).toEqual([...catalogo]);
  });

  it('no hay CHECK IN sin catálogo asociado (salvo origen y la escala de empleadores)', () => {
    const sinCatalogo = [...dominios.keys()].filter((c) => !(c in DOMINIOS) && c !== 'origen' && c !== 'codigo');
    expect(sinCatalogo).toEqual([]);
  });
});
