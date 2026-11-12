/**
 * Valores de control de los análisis sobre la base real de public/data: 152 titulados (del CSV) y
 * 51 empleadores (del .xlsx). Los de empleadores son los del informe; los de titulados cambiaron
 * respecto del informe (148) porque el CSV agrega 4 titulados.
 */
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
import { leerBaseRealLocal } from './baseRealLocal';

const base = await leerBaseRealLocal();
const titulados = base.titulados ?? [];
const empleadores = base.empleadores ?? [];

describe('HU1 – Años de vida profesional (Tabla 2)', () => {
  const hu1 = analizarVidaProfesional(titulados);

  it('n = 149, media 8,63, mediana 5, DE 7,90, Q1 2, Q3 14, rango 0–35', () => {
    const g = hu1.general;
    expect(g?.n).toBe(149);
    expect(redondear(g?.media ?? 0, 2)).toBe(8.63);
    expect(redondear(g?.mediana ?? 0, 2)).toBe(5);
    expect(redondear(g?.desviacion ?? 0, 2)).toBe(7.9);
    expect(g?.q1).toBe(2);
    expect(g?.q3).toBe(14);
    expect([g?.min, g?.max]).toEqual([0, 35]);
    expect(hu1.sinDato).toBe(3);
  });

  it('segmentación: 66 junior (44,3 %) y 83 consolidados (55,7 %)', () => {
    const nJ = hu1.junior?.n ?? 0;
    const nC = hu1.consolidado?.n ?? 0;
    expect([nJ, nC]).toEqual([66, 83]);
    expect(redondear((100 * nJ) / (nJ + nC), 1)).toBe(44.3);
    expect(redondear((100 * nC) / (nJ + nC), 1)).toBe(55.7);
  });

  it('perfil (Figura 2): edades 6/36/30/15/65 y género 118/34', () => {
    const perfil = analizarPerfil(titulados);
    expect(perfil.edades.filas.map((f) => f.n)).toEqual([6, 36, 30, 15, 65]);
    expect(perfil.generos.filas.map((f) => [f.categoria, f.n, redondear(f.porcentaje, 1)])).toEqual([
      ['Hombre', 118, 77.6],
      ['Mujer', 34, 22.4]
    ]);
  });

  it('desempleo: mediana cesante 1 año (n = 146), tasa 9,3 % y 60 de 146 nunca desempleados', () => {
    const d = analizarDesempleo(titulados);
    expect(d.tiempoCesante?.n).toBe(146);
    expect(redondear(d.tiempoCesante?.mediana ?? 0, 2)).toBe(1);
    expect(redondear(d.tasaSobreTrayectoria ?? 0, 1)).toBe(9.3);
    expect([d.nuncaDesempleado.n, d.nuncaDesempleado.total, redondear(d.nuncaDesempleado.porcentaje, 1)]).toEqual([60, 146, 41.1]);
  });

  it('el histograma de 1 año cubre los 149 datos de 0 a 35', () => {
    const anios = titulados.map((t) => t.anios_vida_profesional).filter((v): v is number => v !== undefined);
    const h = histograma(anios, 1);
    expect(h).toHaveLength(36);
    expect(h.reduce((s, i) => s + i.n, 0)).toBe(149);
  });

  it('descriptivos por segmento', () => {
    expect([redondear(hu1.junior?.media ?? 0), redondear(hu1.junior?.desviacion ?? 0)]).toEqual([1.9, 1.03]);
    expect([redondear(hu1.consolidado?.media ?? 0), redondear(hu1.consolidado?.desviacion ?? 0)]).toEqual([13.99, 6.81]);
  });
});

describe('HU2 – Demanda de posgrado (Figuras 4 y 5)', () => {
  const hu2 = analizarDemandaPosgrado(titulados);

  it('áreas de interés (n = 126): IA 55, Software 31, Redes 25, BD 10, Robótica 5', () => {
    expect(hu2.areas.total).toBe(126);
    expect(hu2.areas.filas.map((f) => [f.categoria, f.n, redondear(f.porcentaje, 1)])).toEqual([
      ['IA', 55, 43.7],
      ['Ingeniería de Software', 31, 24.6],
      ['Redes de Datos y Seguridad', 25, 19.8],
      ['Base de Datos', 10, 7.9],
      ['Robótica', 5, 4]
    ]);
  });

  it('las 2 áreas principales suman 68,3 %: sin alerta, "cerca del umbral"', () => {
    expect(hu2.concentracionAreas.categorias).toEqual(['IA', 'Ingeniería de Software']);
    expect(redondear(hu2.concentracionAreas.porcentaje, 1)).toBe(68.3);
    expect(hu2.alertaAreas).toBe('cerca');
  });

  it('interés en posgrado 82,8 % (125 de 151, p del escenario A) e institución preferida (Figura 6)', () => {
    expect([hu2.interesados.n, hu2.interesados.total, redondear(hu2.interesados.porcentaje, 1)]).toEqual([125, 151, 82.8]);
    expect(Object.fromEntries(hu2.instituciones.filas.map((f) => [f.categoria, f.n]))).toEqual({
      'Posgrado FCyT': 40,
      EUPG: 13,
      'Univ. públicas nacionales': 18,
      'Univ. privadas nacionales': 10,
      'Univ. internacionales': 31,
      IBNORCA: 3,
      Otro: 11
    });
  });

  it('formación realizada 66,4 % y financiamiento (Tabla 3): 92 / 6 / 3, con beca 8,9 %', () => {
    expect(redondear(hu2.cursaron.porcentaje, 1)).toBe(66.4);
    expect(hu2.financiamientos.filas.map((f) => f.n)).toEqual([92, 6, 3]);
    expect([hu2.conBeca.n, redondear(hu2.conBeca.porcentaje, 1)]).toEqual([9, 8.9]);
    expect(hu2.lugares.filas.map((f) => f.n)).toEqual([32, 21, 21, 14, 5, 8]);
  });

  it('nivel de posgrado (n = 101, informativo): Diplomado 69, Maestría 27 → 95,0 %', () => {
    expect(hu2.niveles.total).toBe(101);
    expect(hu2.niveles.filas.map((f) => [f.categoria, f.n])).toEqual([
      ['Diplomado', 69],
      ['Especialidad', 3],
      ['Maestría', 27],
      ['Doctorado', 2]
    ]);
    expect(redondear(hu2.concentracionNiveles.porcentaje, 1)).toBe(95);
  });
});

describe('HU3 – Pruebas de independencia (Tabla 4)', () => {
  it('Nivel (Diplomado vs. Esp./Maest./Doct.) × Financiamiento (Propios vs. Beca)', () => {
    const tabla = tablaNivelFinanciamiento(titulados);
    expect(tabla.observadas).toEqual([[65, 4], [27, 5]]);
    expect(tabla.totalesFila).toEqual([69, 32]);

    const p = pruebaIndependencia(tabla);
    expect(p).not.toBeNull();
    expect(redondear(p?.yates?.estadistico ?? 0, 3)).toBe(1.532);
    expect(redondear(p?.yates?.pValor ?? 0, 4)).toBe(0.2159);
    expect(redondear(p?.sinCorreccion.pValor ?? 0, 4)).toBe(0.1068);
    expect(redondear(p?.fisher?.pValor ?? 0, 4)).toBe(0.1374);
    expect(p?.yates?.gl).toBe(1);
    expect(redondear(p?.yates?.valorCritico ?? 0, 3)).toBe(3.841);
    // Hay una frecuencia esperada < 5 (32·9/101 ≈ 2,85) → resultado oficial: Fisher
    expect(p?.hayEsperadaMenor5).toBe(true);
    expect(p?.metodoOficial).toBe('fisher');
    expect(p?.rechazaH0).toBe(false);
  });

  it('Sector (privado / público) × Remuneración (≤ / > Bs. 7 000)', () => {
    const tabla = tablaSectorRemuneracion(titulados);
    expect(tabla.observadas).toEqual([[34, 38], [16, 5]]);

    const p = pruebaIndependencia(tabla);
    expect(redondear(p?.yates?.estadistico ?? 0, 3)).toBe(4.385);
    expect(redondear(p?.yates?.pValor ?? 0, 4)).toBe(0.0363);
    expect(redondear(p?.fisher?.pValor ?? 0, 4)).toBe(0.0251);
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

  it('Área × institución (Base de Datos y Robótica agrupadas): χ² 8.934, gl 6, p 0.1773, V 0.188', () => {
    const p = resultado('area-institucion');
    expect(p?.es2x2).toBe(false);
    expect(p?.metodoOficial).toBe('chi2');
    expect(redondear(p?.estadisticoOficial ?? 0, 3)).toBe(8.934);
    expect(p?.sinCorreccion.gl).toBe(6);
    expect(redondear(p?.pValorOficial ?? 0, 4)).toBe(0.1773);
    expect(redondear(p?.vCramer ?? 0, 3)).toBe(0.188);
    expect(p?.aproximacionAdecuada).toBe(true);
  });

  it('Edad × formación: Yates χ² 0.649, p 0.4204, V 0.065', () => {
    const p = resultado('edad-formacion');
    expect(p?.tabla.observadas).toEqual([[45, 27], [56, 24]]);
    expect(p?.metodoOficial).toBe('yates');
    expect(redondear(p?.estadisticoOficial ?? 0, 3)).toBe(0.649);
    expect(redondear(p?.pValorOficial ?? 0, 4)).toBe(0.4204);
    expect(redondear(p?.vCramer ?? 0, 3)).toBe(0.065);
  });

  it('V de Cramér: 0.12 (nivel × financiamiento) y 0.22 (sector × remuneración)', () => {
    expect(redondear(resultado('nivel-financiamiento')?.vCramer ?? 0, 2)).toBe(0.12);
    expect(redondear(resultado('sector-remuneracion')?.vCramer ?? 0, 2)).toBe(0.22);
  });

  it('mapa de calor área × institución (Figura 7)', () => {
    expect(tablaAreaInstitucion(titulados).observadas).toEqual([[21, 17, 17], [14, 10, 7], [10, 3, 12], [6, 0, 4], [2, 1, 2]]);
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
      ['satisfaccion_global', 151, 2.77, 0.62, 73.5],
      ['concordancia_formacion', 151, 2.63, 0.62, 62.3],
      ['pertinencia_labores', 110, 3.23, 0.76, 89.1],
      ['opinion_posgrado_fcyt', 152, 2.66, 0.78, 70.4]
    ]);
  });
});

describe('HU4 – Aspectos y asignaturas (Figuras 18 a 21, % sobre 152)', () => {
  const a = analizarAspectosFormacion(titulados);
  const ns = (t: { filas: Array<{ n: number }> }) => t.filas.map((f) => f.n);

  it('aspectos útiles y a mejorar', () => {
    expect(ns(a.utiles)).toEqual([82, 66, 62, 50, 45, 33]);
    expect(ns(a.mejorar)).toEqual([107, 93, 89, 79, 56, 46]);
    expect(redondear(a.mejorar.filas[0].porcentaje, 1)).toBe(70.4);
  });

  it('asignaturas con ventaja competitiva y de poca utilidad', () => {
    expect(ns(a.asignaturasVentaja)).toEqual([144, 111, 110, 83, 79, 72, 68, 63, 31]);
    expect(redondear(a.asignaturasVentaja.filas[0].porcentaje, 1)).toBe(94.7);
    expect(ns(a.asignaturasNoUtiles)).toEqual([76, 70, 66, 59, 50, 49, 47, 41, 41, 35, 17]);
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

  it('situación laboral 109 / 17 / 26 y ocupación 82.9 %', () => {
    expect(ns(m.situaciones)).toEqual([109, 17, 26]);
    expect(redondear(m.ocupacion.porcentaje, 1)).toBe(82.9);
    expect(redondear(m.sectorEnOrganizacion.filas[0].porcentaje, 1)).toBe(79.8);
    expect(redondear(m.departamentos.filas[0].porcentaje, 1)).toBe(88);
  });

  it('rubro, cargo y tiempo al primer empleo (n = 104, 76.9 % en 4 meses o menos)', () => {
    expect(ns(m.rubros)).toEqual([69, 12, 9, 9, 7, 4, 0]);
    expect(ns(m.cargos)).toEqual([72, 17, 13, 8, 0]);
    expect(ns(m.tiempos)).toEqual([55, 11, 14, 6, 13, 5]);
    expect(redondear(m.insercionRapida.porcentaje, 1)).toBe(76.9);
  });

  it('remuneración según sector (Figura 11)', () => {
    expect(pcts(m.remuneracionPorSector[0].tabla)).toEqual([8.3, 4.2, 16.7, 18.1, 23.6, 29.2]);
    expect(pcts(m.remuneracionPorSector[1].tabla)).toEqual([0, 33.3, 19, 23.8, 19, 4.8]);
  });

  it('razones de no trabajar (n = 25) y emprendedores (n = 17)', () => {
    expect(ns(m.razonesNoTrabaja)).toEqual([7, 6, 4, 2, 1, 1, 4]);
    const e = m.emprendimiento;
    expect(e.total).toBe(17);
    expect(e.origen.filas[0].n + e.origen.filas[1].n).toBe(13);
    expect(redondear(e.financiamiento.filas[0].porcentaje, 1)).toBe(68.8);
    expect(redondear(e.satisfaccion.filas[0].porcentaje, 1)).toBe(56.3);
    expect(e.importancia.filas[0].n + e.importancia.filas[1].n).toBe(13);
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
