/**
 * Valores de control: los análisis calculados sobre la base real deben reproducir el informe.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AFIRMACIONES_RADAR } from '../data/strategicPlan';
import {
  analizarAspectosFormacion,
  analizarEmpleadores,
  analizarMercadoTitulados,
  codigoItem,
  indicePorItem,
  analizarDemandaPosgrado,
  analizarDesempleo,
  analizarPerfil,
  analizarValoracionTitulados,
  analizarVidaProfesional,
  indicesPorDimension,
  PRUEBAS_INDEPENDENCIA,
  tablaAreaInstitucion,
  tablaNivelFinanciamiento,
  tablaSectorRemuneracion
} from './analisis';
import { histograma, pruebaIndependencia, redondear } from './estadistica';
import { importarArchivo } from './importador';

const buffer = readFileSync(resolve(import.meta.dirname, '../../public/data/Base_Limpia_Titulados_Empleadores.xlsx'));
const base = await importarArchivo(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  'base.xlsx'
);
const titulados = base.titulados ?? [];
const empleadores = base.empleadores ?? [];

describe('HU1 – Años de vida profesional (Tabla 2)', () => {
  const hu1 = analizarVidaProfesional(titulados);

  it('n = 145, media 8,83, mediana 6, DE 7,92, Q1 2, Q3 14, rango 0–35', () => {
    const g = hu1.general;
    expect(g?.n).toBe(145);
    expect(redondear(g?.media ?? 0, 2)).toBe(8.83);
    expect(redondear(g?.mediana ?? 0, 2)).toBe(6);
    expect(redondear(g?.desviacion ?? 0, 2)).toBe(7.92);
    expect(g?.q1).toBe(2);
    expect(g?.q3).toBe(14);
    expect([g?.min, g?.max]).toEqual([0, 35]);
    expect(hu1.sinDato).toBe(3);
  });

  it('segmentación: 62 junior (42,8 %) y 83 consolidados (57,2 %)', () => {
    const nJ = hu1.junior?.n ?? 0;
    const nC = hu1.consolidado?.n ?? 0;
    expect([nJ, nC]).toEqual([62, 83]);
    expect(redondear((100 * nJ) / (nJ + nC), 1)).toBe(42.8);
    expect(redondear((100 * nC) / (nJ + nC), 1)).toBe(57.2);
  });

  it('perfil (Figura 2): edades 5/34/30/15/64 y género 115/33', () => {
    const perfil = analizarPerfil(titulados);
    expect(perfil.edades.filas.map((f) => f.n)).toEqual([5, 34, 30, 15, 64]);
    expect(perfil.generos.filas.map((f) => [f.categoria, f.n, redondear(f.porcentaje, 1)])).toEqual([
      ['Hombre', 115, 77.7],
      ['Mujer', 33, 22.3]
    ]);
  });

  it('desempleo: mediana cesante 0,75 años (n = 143), tasa 9,0 % y 60 de 143 nunca desempleados', () => {
    const d = analizarDesempleo(titulados);
    expect(d.tiempoCesante?.n).toBe(143);
    expect(redondear(d.tiempoCesante?.mediana ?? 0, 2)).toBe(0.75);
    expect(redondear(d.tasaSobreTrayectoria ?? 0, 1)).toBe(9);
    expect([d.nuncaDesempleado.n, d.nuncaDesempleado.total, redondear(d.nuncaDesempleado.porcentaje, 1)]).toEqual([60, 143, 42]);
  });

  it('el histograma de 1 año cubre los 145 datos de 0 a 35', () => {
    const anios = titulados.map((t) => t.anios_vida_profesional).filter((v): v is number => v !== undefined);
    const h = histograma(anios, 1);
    expect(h).toHaveLength(36);
    expect(h.reduce((s, i) => s + i.n, 0)).toBe(145);
  });

  it('descriptivos por segmento', () => {
    expect([redondear(hu1.junior?.media ?? 0), redondear(hu1.junior?.desviacion ?? 0)]).toEqual([1.93, 1.06]);
    expect([redondear(hu1.consolidado?.media ?? 0), redondear(hu1.consolidado?.desviacion ?? 0)]).toEqual([13.99, 6.81]);
  });
});

describe('HU2 – Demanda de posgrado (Figuras 4 y 5)', () => {
  const hu2 = analizarDemandaPosgrado(titulados);

  it('áreas de interés (n = 123): IA 54, Software 29, Redes 25, BD 10, Robótica 5', () => {
    expect(hu2.areas.total).toBe(123);
    expect(hu2.areas.filas.map((f) => [f.categoria, f.n, redondear(f.porcentaje, 1)])).toEqual([
      ['IA', 54, 43.9],
      ['Ingeniería de Software', 29, 23.6],
      ['Redes de Datos y Seguridad', 25, 20.3],
      ['Base de Datos', 10, 8.1],
      ['Robótica', 5, 4.1]
    ]);
  });

  it('las 2 áreas principales suman 67,5 %: sin alerta, "cerca del umbral"', () => {
    expect(hu2.concentracionAreas.categorias).toEqual(['IA', 'Ingeniería de Software']);
    expect(redondear(hu2.concentracionAreas.porcentaje, 1)).toBe(67.5);
    expect(hu2.alertaAreas).toBe('cerca');
  });

  it('interés en posgrado 83,0 % (122 de 147, p del escenario A) e institución preferida (Figura 6)', () => {
    expect([hu2.interesados.n, hu2.interesados.total, redondear(hu2.interesados.porcentaje, 1)]).toEqual([122, 147, 83]);
    expect(Object.fromEntries(hu2.instituciones.filas.map((f) => [f.categoria, f.n]))).toEqual({
      'Posgrado FCyT': 38,
      EUPG: 13,
      'Univ. públicas nacionales': 17,
      'Univ. privadas nacionales': 10,
      'Univ. internacionales': 31,
      IBNORCA: 3,
      Otro: 11
    });
  });

  it('formación realizada 66,2 % y financiamiento (Tabla 3): 90 / 5 / 3, con beca 8,2 %', () => {
    expect(redondear(hu2.cursaron.porcentaje, 1)).toBe(66.2);
    expect(hu2.financiamientos.filas.map((f) => f.n)).toEqual([90, 5, 3]);
    expect([hu2.conBeca.n, redondear(hu2.conBeca.porcentaje, 1)]).toEqual([8, 8.2]);
    expect(hu2.lugares.filas.map((f) => f.n)).toEqual([30, 21, 20, 14, 5, 8]);
  });

  it('nivel de posgrado (n = 98, informativo): Diplomado 66, Maestría 27 → 94,9 %', () => {
    expect(hu2.niveles.total).toBe(98);
    expect(hu2.niveles.filas.map((f) => [f.categoria, f.n])).toEqual([
      ['Diplomado', 66],
      ['Especialidad', 3],
      ['Maestría', 27],
      ['Doctorado', 2]
    ]);
    expect(redondear(hu2.concentracionNiveles.porcentaje, 1)).toBe(94.9);
  });
});

describe('HU3 – Pruebas de independencia (Tabla 4)', () => {
  it('Nivel (Diplomado vs. Esp./Maest./Doct.) × Financiamiento (Propios vs. Beca)', () => {
    const tabla = tablaNivelFinanciamiento(titulados);
    expect(tabla.observadas).toEqual([[63, 3], [27, 5]]);
    expect(tabla.totalesFila).toEqual([66, 32]);

    const p = pruebaIndependencia(tabla);
    expect(p).not.toBeNull();
    expect(redondear(p?.yates?.estadistico ?? 0, 3)).toBe(2.206);
    expect(redondear(p?.yates?.pValor ?? 0, 4)).toBe(0.1375);
    expect(redondear(p?.sinCorreccion.pValor ?? 0, 4)).toBe(0.0603);
    expect(redondear(p?.fisher?.pValor ?? 0, 4)).toBe(0.1089);
    expect(p?.yates?.gl).toBe(1);
    expect(redondear(p?.yates?.valorCritico ?? 0, 3)).toBe(3.841);
    // Hay una frecuencia esperada < 5 (32·8/98 ≈ 2,61) → resultado oficial: Fisher
    expect(p?.hayEsperadaMenor5).toBe(true);
    expect(p?.metodoOficial).toBe('fisher');
    expect(p?.rechazaH0).toBe(false);
  });

  it('Sector (privado / público) × Remuneración (≤ / > Bs. 7 000)', () => {
    const tabla = tablaSectorRemuneracion(titulados);
    expect(tabla.observadas).toEqual([[33, 38], [15, 5]]);

    const p = pruebaIndependencia(tabla);
    expect(redondear(p?.yates?.estadistico ?? 0, 3)).toBe(4.013);
    expect(redondear(p?.yates?.pValor ?? 0, 4)).toBe(0.0452);
    expect(redondear(p?.fisher?.pValor ?? 0, 4)).toBe(0.0409);
    // Todas las esperadas ≥ 5 → resultado oficial: Yates
    expect(p?.hayEsperadaMenor5).toBe(false);
    expect(p?.metodoOficial).toBe('yates');
    expect(p?.rechazaH0).toBe(true);
  });
});

describe('Tabla 4 completa – las cuatro pruebas del informe', () => {
  const resultado = (id: string) => {
    const def = PRUEBAS_INDEPENDENCIA.find((p) => p.id === id);
    return def ? pruebaIndependencia(def.construir(titulados)) : null;
  };

  it('Área × institución (Base de Datos y Robótica agrupadas): χ² 9.726, gl 6, p 0.1367, V 0.199', () => {
    const p = resultado('area-institucion');
    expect(p?.es2x2).toBe(false);
    expect(p?.metodoOficial).toBe('chi2');
    expect(redondear(p?.estadisticoOficial ?? 0, 3)).toBe(9.726);
    expect(p?.sinCorreccion.gl).toBe(6);
    expect(redondear(p?.pValorOficial ?? 0, 4)).toBe(0.1367);
    expect(redondear(p?.vCramer ?? 0, 3)).toBe(0.199);
    expect(p?.aproximacionAdecuada).toBe(true);
  });

  it('Edad × formación: Yates χ² 1.234, p 0.2665, V 0.091', () => {
    const p = resultado('edad-formacion');
    expect(p?.tabla.observadas).toEqual([[42, 27], [56, 23]]);
    expect(p?.metodoOficial).toBe('yates');
    expect(redondear(p?.estadisticoOficial ?? 0, 3)).toBe(1.234);
    expect(redondear(p?.pValorOficial ?? 0, 4)).toBe(0.2665);
    expect(redondear(p?.vCramer ?? 0, 3)).toBe(0.091);
  });

  it('V de Cramér del informe: 0.15 (nivel × financiamiento) y 0.21 (sector × remuneración)', () => {
    expect(redondear(resultado('nivel-financiamiento')?.vCramer ?? 0, 2)).toBe(0.15);
    expect(redondear(resultado('sector-remuneracion')?.vCramer ?? 0, 2)).toBe(0.21);
  });

  it('mapa de calor área × institución (Figura 7)', () => {
    expect(tablaAreaInstitucion(titulados).observadas).toEqual([[20, 17, 17], [13, 10, 6], [10, 3, 12], [6, 0, 4], [2, 1, 2]]);
  });
});

describe('HU4 – Valoración de la formación (Tabla 7)', () => {
  it('n, media, DE y % de acuerdo de los 4 ítems', () => {
    const filas = analizarValoracionTitulados(titulados).map(({ campo, estadisticos: e }) => [
      campo,
      e?.n,
      redondear(e?.media ?? 0, 2),
      redondear(e?.desviacion ?? 0, 2),
      redondear(e?.porcentajeAcuerdo ?? 0, 1)
    ]);
    expect(filas).toEqual([
      ['satisfaccion_global', 147, 2.78, 0.63, 74.1],
      ['concordancia_formacion', 147, 2.63, 0.62, 61.9],
      ['pertinencia_labores', 108, 3.25, 0.75, 90.7],
      ['opinion_posgrado_fcyt', 148, 2.67, 0.78, 70.9]
    ]);
  });
});

describe('HU4 – Aspectos y asignaturas (Figuras 18 a 21, % sobre 148)', () => {
  const a = analizarAspectosFormacion(titulados);
  const ns = (t: { filas: Array<{ n: number }> }) => t.filas.map((f) => f.n);

  it('aspectos útiles y a mejorar', () => {
    expect(ns(a.utiles)).toEqual([82, 66, 62, 50, 45, 32]);
    expect(ns(a.mejorar)).toEqual([106, 92, 88, 78, 55, 46]);
    expect(redondear(a.mejorar.filas[0].porcentaje, 1)).toBe(71.6);
  });

  it('asignaturas con ventaja competitiva y de poca utilidad', () => {
    expect(ns(a.asignaturasVentaja)).toEqual([140, 110, 107, 81, 75, 71, 65, 62, 30]);
    expect(redondear(a.asignaturasVentaja.filas[0].porcentaje, 1)).toBe(94.6);
    expect(ns(a.asignaturasNoUtiles)).toEqual([72, 69, 63, 58, 48, 46, 46, 41, 40, 34, 16]);
  });
});

describe('Empleadores – índices por afirmación del radar (1, 2, 4, 5, 6, 8 y 9)', () => {
  it('72.6 / 60.0 / 65.6 / 57.0 / 63.0 / 64.6 / 69.1', () => {
    expect(AFIRMACIONES_RADAR.map((n) => redondear(indicePorItem(empleadores, codigoItem(n)).indice ?? 0, 1))).toEqual([
      72.6, 60, 65.6, 57, 63, 64.6, 69.1
    ]);
  });
});

describe('Mercado laboral – titulados (Tablas 5 y 6, Figuras 8, 10 y 11)', () => {
  const m = analizarMercadoTitulados(titulados);
  const ns = (t: { filas: Array<{ n: number }> }) => t.filas.map((f) => f.n);
  const pcts = (t: { filas: Array<{ porcentaje: number }> }) => t.filas.map((f) => redondear(f.porcentaje, 1));

  it('situación laboral 108 / 15 / 25 y ocupación 83.1 %', () => {
    expect(ns(m.situaciones)).toEqual([108, 15, 25]);
    expect(redondear(m.ocupacion.porcentaje, 1)).toBe(83.1);
    expect(redondear(m.sectorEnOrganizacion.filas[0].porcentaje, 1)).toBe(80.6);
    expect(redondear(m.departamentos.filas[0].porcentaje, 1)).toBe(88);
  });

  it('rubro, cargo y tiempo al primer empleo (n = 101, 76.2 % en 4 meses o menos)', () => {
    expect(ns(m.rubros)).toEqual([67, 12, 9, 9, 7, 4, 0]);
    expect(ns(m.cargos)).toEqual([70, 17, 13, 8, 0]);
    expect(ns(m.tiempos)).toEqual([53, 10, 14, 6, 13, 5]);
    expect(redondear(m.insercionRapida.porcentaje, 1)).toBe(76.2);
  });

  it('remuneración según sector (Figura 11)', () => {
    expect(pcts(m.remuneracionPorSector[0].tabla)).toEqual([7, 4.2, 16.9, 18.3, 23.9, 29.6]);
    expect(pcts(m.remuneracionPorSector[1].tabla)).toEqual([0, 30, 20, 25, 20, 5]);
  });

  it('razones de no trabajar (n = 25) y emprendedores (n = 15)', () => {
    expect(ns(m.razonesNoTrabaja)).toEqual([7, 6, 4, 2, 1, 1, 4]);
    const e = m.emprendimiento;
    expect(e.total).toBe(15);
    expect(e.origen.filas[0].n + e.origen.filas[1].n).toBe(12);
    expect(redondear(e.financiamiento.filas[0].porcentaje, 1)).toBe(66.7);
    expect(redondear(e.satisfaccion.filas[0].porcentaje, 1)).toBe(53.3);
    expect(e.importancia.filas[0].n + e.importancia.filas[1].n).toBe(12);
  });
});

describe('Mercado laboral – empleadores (Figuras 12 a 15)', () => {
  const e = analizarEmpleadores(empleadores);

  it('tipo, contratación, nivel demandado y cargos', () => {
    expect(e.tipos.filas.map((f) => f.n)).toEqual([39, 12]);
    expect([e.contrato5.n, redondear(e.contrato5.porcentaje, 1)]).toEqual([41, 80.4]);
    expect(e.posibilidad.filas.map((f) => f.n)).toEqual([15, 26, 10]);
    expect(e.niveles.filas.map((f) => f.n)).toEqual([37, 4, 8, 2]);
    expect(e.cargos.filas.map((f) => f.n)).toEqual([36, 26, 22, 20, 16, 11, 7]);
    expect(e.rubros.filas[0]).toMatchObject({ categoria: 'Desarrollo de software', n: 21 });
  });

  it('tecnologías demandadas sobre 50 respuestas válidas: 82 / 32 / 28 / 24 / 24 / 20 / 14 / 12 %', () => {
    expect(e.tecnologias.validas).toBe(50);
    expect(e.tecnologias.temas.map((t) => redondear(t.porcentaje, 1))).toEqual([82, 32, 28, 24, 24, 20, 14, 12]);
  });
});

describe('Empleadores – Índice de acuerdo por dimensión (Tabla 8, Ecuación 2)', () => {
  it('64,4 / 65,6 / 43,8 / 34,5 (promedio de los índices por afirmación)', () => {
    expect(indicesPorDimension(empleadores).map((d) => redondear(d.indice ?? 0, 1))).toEqual([64.4, 65.6, 43.8, 34.5]);
  });
});
