/**
 * Valores de control de los análisis sobre la base real de public/data (184 titulados y 78
 * empleadores, generada con npm run cargar-encuestas desde los Excel de los formularios). Cambian
 * respecto del informe, que usó 148 titulados y 51 empleadores.
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

  it('n = 181, media 9,04, mediana 6, DE 7,63, Q1 2, Q3 14, rango 0–35', () => {
    const g = hu1.general;
    expect(g?.n).toBe(181);
    expect(redondear(g?.media ?? 0, 2)).toBe(9.04);
    expect(redondear(g?.mediana ?? 0, 2)).toBe(6);
    expect(redondear(g?.desviacion ?? 0, 2)).toBe(7.63);
    expect(g?.q1).toBe(2);
    expect(g?.q3).toBe(14);
    expect([g?.min, g?.max]).toEqual([0, 35]);
    expect(hu1.sinDato).toBe(3);
  });

  it('segmentación: 71 junior (39,2 %) y 110 consolidados (60,8 %)', () => {
    const nJ = hu1.junior?.n ?? 0;
    const nC = hu1.consolidado?.n ?? 0;
    expect([nJ, nC]).toEqual([71, 110]);
    expect(redondear((100 * nJ) / (nJ + nC), 1)).toBe(39.2);
    expect(redondear((100 * nC) / (nJ + nC), 1)).toBe(60.8);
  });

  it('perfil (Figura 2): edades 6/38/35/23/82 y género 147/37', () => {
    const perfil = analizarPerfil(titulados);
    expect(perfil.edades.filas.map((f) => f.n)).toEqual([6, 38, 35, 23, 82]);
    expect(perfil.generos.filas.map((f) => [f.categoria, f.n, redondear(f.porcentaje, 1)])).toEqual([
      ['Hombre', 147, 79.9],
      ['Mujer', 37, 20.1]
    ]);
  });

  it('desempleo: mediana cesante 1 año (n = 180), tasa 9,7 % y 69 de 180 nunca desempleados', () => {
    const d = analizarDesempleo(titulados);
    expect(d.tiempoCesante?.n).toBe(180);
    expect(redondear(d.tiempoCesante?.mediana ?? 0, 2)).toBe(1);
    expect(redondear(d.tasaSobreTrayectoria ?? 0, 1)).toBe(9.7);
    expect([d.nuncaDesempleado.n, d.nuncaDesempleado.total, redondear(d.nuncaDesempleado.porcentaje, 1)]).toEqual([69, 180, 38.3]);
  });

  it('el histograma de 1 año cubre los 181 datos de 0 a 35', () => {
    const anios = titulados.map((t) => t.anios_vida_profesional).filter((v): v is number => v !== undefined);
    const h = histograma(anios, 1);
    expect(h).toHaveLength(36);
    expect(h.reduce((s, i) => s + i.n, 0)).toBe(181);
  });

  it('descriptivos por segmento', () => {
    expect([redondear(hu1.junior?.media ?? 0), redondear(hu1.junior?.desviacion ?? 0)]).toEqual([2.01, 1.08]);
    expect([redondear(hu1.consolidado?.media ?? 0), redondear(hu1.consolidado?.desviacion ?? 0)]).toEqual([13.57, 6.51]);
  });
});

describe('HU2 – Demanda de posgrado (Figuras 4 y 5)', () => {
  const hu2 = analizarDemandaPosgrado(titulados);

  it('áreas de interés (n = 155): IA 70, Software 37, Redes 32, BD 11, Robótica 5', () => {
    expect(hu2.areas.total).toBe(155);
    expect(hu2.areas.filas.map((f) => [f.categoria, f.n, redondear(f.porcentaje, 1)])).toEqual([
      ['IA', 70, 45.2],
      ['Ingeniería de Software', 37, 23.9],
      ['Redes de Datos y Seguridad', 32, 20.6],
      ['Base de Datos', 11, 7.1],
      ['Robótica', 5, 3.2]
    ]);
  });

  it('las 2 áreas principales suman 69,0 %: sin alerta, "cerca del umbral"', () => {
    expect(hu2.concentracionAreas.categorias).toEqual(['IA', 'Ingeniería de Software']);
    expect(redondear(hu2.concentracionAreas.porcentaje, 1)).toBe(69);
    expect(hu2.alertaAreas).toBe('cerca');
  });

  it('interés en posgrado 84,2 % (155 de 184, p del escenario A) e institución preferida (Figura 6)', () => {
    expect([hu2.interesados.n, hu2.interesados.total, redondear(hu2.interesados.porcentaje, 1)]).toEqual([155, 184, 84.2]);
    expect(Object.fromEntries(hu2.instituciones.filas.map((f) => [f.categoria, f.n]))).toEqual({
      'Posgrado FCyT': 48,
      EUPG: 16,
      'Univ. públicas nacionales': 22,
      'Univ. privadas nacionales': 16,
      'Univ. internacionales': 36,
      IBNORCA: 3,
      Otro: 14
    });
  });

  it('formación realizada 64,7 % y financiamiento (Tabla 3): 111 / 5 / 3, con beca 6,7 %', () => {
    expect(redondear(hu2.cursaron.porcentaje, 1)).toBe(64.7);
    expect(hu2.financiamientos.filas.map((f) => f.n)).toEqual([111, 5, 3]);
    expect([hu2.conBeca.n, redondear(hu2.conBeca.porcentaje, 1)]).toEqual([8, 6.7]);
    expect(hu2.lugares.filas.map((f) => f.n)).toEqual([35, 23, 23, 22, 5, 11]);
  });

  it('nivel de posgrado (n = 119, informativo): Diplomado 80, Maestría 32 → 94,1 %', () => {
    expect(hu2.niveles.total).toBe(119);
    expect(hu2.niveles.filas.map((f) => [f.categoria, f.n])).toEqual([
      ['Diplomado', 80],
      ['Especialidad', 4],
      ['Maestría', 32],
      ['Doctorado', 3]
    ]);
    expect(redondear(hu2.concentracionNiveles.porcentaje, 1)).toBe(94.1);
  });
});

describe('HU3 – Pruebas de independencia (Tabla 4)', () => {
  it('Nivel (Diplomado vs. Esp./Maest./Doct.) × Financiamiento (Propios vs. Beca)', () => {
    const tabla = tablaNivelFinanciamiento(titulados);
    expect(tabla.observadas).toEqual([[77, 3], [34, 5]]);
    expect(tabla.totalesFila).toEqual([80, 39]);

    const p = pruebaIndependencia(tabla);
    expect(p).not.toBeNull();
    expect(redondear(p?.yates?.estadistico ?? 0, 3)).toBe(2.146);
    expect(redondear(p?.yates?.pValor ?? 0, 4)).toBe(0.143);
    expect(redondear(p?.sinCorreccion.pValor ?? 0, 4)).toBe(0.0636);
    expect(redondear(p?.fisher?.pValor ?? 0, 4)).toBe(0.1121);
    expect(p?.yates?.gl).toBe(1);
    expect(redondear(p?.yates?.valorCritico ?? 0, 3)).toBe(3.841);
    // Hay una frecuencia esperada < 5 (39·8/119 ≈ 2,62) → resultado oficial: Fisher
    expect(p?.hayEsperadaMenor5).toBe(true);
    expect(p?.metodoOficial).toBe('fisher');
    expect(p?.rechazaH0).toBe(false);
  });

  it('Sector (privado / público) × Remuneración (≤ / > Bs. 7 000)', () => {
    const tabla = tablaSectorRemuneracion(titulados);
    expect(tabla.observadas).toEqual([[44, 62], [25, 8]]);

    const p = pruebaIndependencia(tabla);
    expect(redondear(p?.yates?.estadistico ?? 0, 3)).toBe(10.477);
    expect(redondear(p?.yates?.pValor ?? 0, 4)).toBe(0.0012);
    expect(redondear(p?.fisher?.pValor ?? 0, 4)).toBe(0.0007);
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

  it('Área × institución (Base de Datos y Robótica agrupadas): χ² 9.458, gl 6, p 0.1494, V 0.175', () => {
    const p = resultado('area-institucion');
    expect(p?.es2x2).toBe(false);
    expect(p?.metodoOficial).toBe('chi2');
    expect(redondear(p?.estadisticoOficial ?? 0, 3)).toBe(9.458);
    expect(p?.sinCorreccion.gl).toBe(6);
    expect(redondear(p?.pValorOficial ?? 0, 4)).toBe(0.1494);
    expect(redondear(p?.vCramer ?? 0, 3)).toBe(0.175);
    expect(p?.aproximacionAdecuada).toBe(true);
  });

  it('Edad × formación: Yates χ² 4.220, p 0.0400, V 0.151 (significativa con la base nueva)', () => {
    const p = resultado('edad-formacion');
    expect(p?.tabla.observadas).toEqual([[44, 35], [75, 30]]);
    expect(p?.metodoOficial).toBe('yates');
    expect(redondear(p?.estadisticoOficial ?? 0, 3)).toBe(4.22);
    expect(redondear(p?.pValorOficial ?? 0, 4)).toBe(0.04);
    expect(redondear(p?.vCramer ?? 0, 3)).toBe(0.151);
    // Con 148 titulados no era significativa (p 0.2665); con 184, sí
    expect(p?.rechazaH0).toBe(true);
  });

  it('V de Cramér: 0.13 (nivel × financiamiento) y 0.27 (sector × remuneración)', () => {
    expect(redondear(resultado('nivel-financiamiento')?.vCramer ?? 0, 2)).toBe(0.13);
    expect(redondear(resultado('sector-remuneracion')?.vCramer ?? 0, 2)).toBe(0.27);
  });

  it('mapa de calor área × institución (Figura 7)', () => {
    expect(tablaAreaInstitucion(titulados).observadas).toEqual([[28, 18, 24], [15, 13, 9], [13, 3, 16], [6, 1, 4], [2, 1, 2]]);
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
      ['satisfaccion_global', 182, 2.8, 0.64, 75.3],
      ['concordancia_formacion', 183, 2.61, 0.64, 60.7],
      ['pertinencia_labores', 139, 3.26, 0.75, 90.6],
      ['opinion_posgrado_fcyt', 184, 2.64, 0.78, 69]
    ]);
  });
});

describe('HU4 – Aspectos y asignaturas (Figuras 18 a 21, % sobre 184)', () => {
  const a = analizarAspectosFormacion(titulados);
  const ns = (t: { filas: Array<{ n: number }> }) => t.filas.map((f) => f.n);

  it('aspectos útiles y a mejorar', () => {
    expect(ns(a.utiles)).toEqual([105, 82, 78, 66, 56, 38]);
    expect(ns(a.mejorar)).toEqual([134, 118, 110, 97, 71, 55]);
    expect(redondear(a.mejorar.filas[0].porcentaje, 1)).toBe(72.8);
  });

  it('asignaturas con ventaja competitiva y de poca utilidad', () => {
    expect(ns(a.asignaturasVentaja)).toEqual([172, 136, 128, 106, 98, 83, 85, 75, 37]);
    expect(redondear(a.asignaturasVentaja.filas[0].porcentaje, 1)).toBe(93.5);
    expect(ns(a.asignaturasNoUtiles)).toEqual([97, 84, 78, 80, 65, 64, 61, 54, 59, 50, 24]);
  });
});

describe('Empleadores – índices por afirmación del radar (1, 2, 4, 5, 6, 8 y 9)', () => {
  it('70.5 / 59.9 / 63.6 / 58.4 / 59.5 / 61.5 / 69.2', () => {
    expect(AFIRMACIONES_RADAR.map((n) => redondear(indicePorItem(empleadores, codigoItem(n)).indice ?? 0, 1))).toEqual([
      70.5, 59.9, 63.6, 58.4, 59.5, 61.5, 69.2
    ]);
  });
});

describe('Mercado laboral – titulados (Tablas 5 y 6, Figuras 8, 10 y 11)', () => {
  const m = analizarMercadoTitulados(titulados);
  const ns = (t: { filas: Array<{ n: number }> }) => t.filas.map((f) => f.n);
  const pcts = (t: { filas: Array<{ porcentaje: number }> }) => t.filas.map((f) => redondear(f.porcentaje, 1));

  it('situación laboral 139 / 17 / 28 y ocupación 84.8 %', () => {
    expect(ns(m.situaciones)).toEqual([139, 17, 28]);
    expect(redondear(m.ocupacion.porcentaje, 1)).toBe(84.8);
    expect(redondear(m.sectorEnOrganizacion.filas[0].porcentaje, 1)).toBe(76.3);
    expect(redondear(m.departamentos.filas[0].porcentaje, 1)).toBe(89.2);
  });

  it('rubro, cargo y tiempo al primer empleo (n = 134, 73.9 % en 4 meses o menos)', () => {
    expect(ns(m.rubros)).toEqual([89, 15, 10, 13, 8, 4, 0]);
    expect(ns(m.cargos)).toEqual([88, 22, 20, 9, 0]);
    expect(ns(m.tiempos)).toEqual([69, 12, 18, 12, 16, 7]);
    expect(redondear(m.insercionRapida.porcentaje, 1)).toBe(73.9);
  });

  it('remuneración según sector (Figura 11)', () => {
    expect(pcts(m.remuneracionPorSector[0].tabla)).toEqual([4.7, 4.7, 16, 16, 24.5, 34]);
    expect(pcts(m.remuneracionPorSector[1].tabla)).toEqual([0, 18.2, 33.3, 24.2, 21.2, 3]);
  });

  it('razones de no trabajar (n = 28) y emprendedores (n = 17)', () => {
    expect(ns(m.razonesNoTrabaja)).toEqual([8, 6, 4, 2, 2, 1, 5]);
    const e = m.emprendimiento;
    expect(e.total).toBe(17);
    expect(e.origen.filas[0].n + e.origen.filas[1].n).toBe(14);
    expect(redondear(e.financiamiento.filas[0].porcentaje, 1)).toBe(70.6);
    expect(redondear(e.satisfaccion.filas[0].porcentaje, 1)).toBe(47.1);
    expect(e.importancia.filas[0].n + e.importancia.filas[1].n).toBe(14);
  });
});

describe('Mercado laboral – empleadores (Figuras 12 a 15)', () => {
  const e = analizarEmpleadores(empleadores);

  it('tipo, contratación, nivel demandado y cargos', () => {
    expect(e.tipos.filas.map((f) => f.n)).toEqual([62, 16]);
    expect([e.contrato5.n, redondear(e.contrato5.porcentaje, 1)]).toEqual([65, 83.3]);
    expect(e.posibilidad.filas.map((f) => f.n)).toEqual([22, 44, 12]);
    expect(e.niveles.filas.map((f) => f.n)).toEqual([58, 5, 13, 2]);
    expect(e.cargos.filas.map((f) => f.n)).toEqual([58, 33, 31, 31, 21, 16, 11]);
    expect(e.rubros.filas[0]).toMatchObject({ categoria: 'Desarrollo de software', n: 33 });
  });

  it('tecnologías demandadas sobre 76 respuestas válidas: 82.9 / 30.3 / 28.9 / 15.8 / 26.3 / 23.7 / 9.2 / 14.5 %', () => {
    expect(e.tecnologias.validas).toBe(76);
    expect(e.tecnologias.temas.map((t) => redondear(t.porcentaje, 1))).toEqual([82.9, 30.3, 28.9, 15.8, 26.3, 23.7, 9.2, 14.5]);
  });
});

describe('Empleadores – Índice de acuerdo por dimensión (Tabla 8, Ecuación 2)', () => {
  it('63,2 / 63,6 / 45,3 / 39,5 (promedio de los índices por afirmación)', () => {
    expect(indicesPorDimension(empleadores).map((d) => redondear(d.indice ?? 0, 1))).toEqual([63.2, 63.6, 45.3, 39.5]);
  });
});
