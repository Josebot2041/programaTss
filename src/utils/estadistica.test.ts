import { describe, expect, it } from 'vitest';
import {
  chiCuadrado,
  chiCuadradoCritico,
  chiCuadradoPValor,
  concentracionPrincipales,
  crearTablaCruzada,
  descriptivos,
  estadisticosLikert,
  evaluarConcentracion,
  fisherExacto2x2,
  frecuencias,
  indiceAcuerdo,
  lnGamma,
  pruebaIndependencia,
  redondear,
  bondadAjuste,
  intervaloConfianzaT,
  pruebaCorridas,
  pruebaTWelch,
  tCritico,
  tPValorBilateral
} from './estadistica';

describe('Funciones especiales (valores de tablas estadísticas)', () => {
  it('lnGamma coincide con ln((n−1)!) y con Γ(1/2) = √π', () => {
    expect(lnGamma(5)).toBeCloseTo(Math.log(24), 10);
    expect(lnGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 10);
  });

  it('valores críticos χ² para α = 0,05 y α = 0,01', () => {
    expect(redondear(chiCuadradoCritico(0.05, 1), 3)).toBe(3.841);
    expect(redondear(chiCuadradoCritico(0.05, 6), 3)).toBe(12.592);
    expect(redondear(chiCuadradoCritico(0.05, 9), 3)).toBe(16.919);
    expect(redondear(chiCuadradoCritico(0.05, 44), 3)).toBe(60.481);
    expect(redondear(chiCuadradoCritico(0.01, 10), 3)).toBe(23.209);
  });

  it('p-valor χ² en el valor crítico es α', () => {
    expect(chiCuadradoPValor(3.841459, 1)).toBeCloseTo(0.05, 6);
    expect(chiCuadradoPValor(18.307038, 10)).toBeCloseTo(0.05, 6);
    expect(chiCuadradoPValor(0, 3)).toBe(1);
  });
});

describe('Distribución t de Student (valores de tabla)', () => {
  it('valores críticos bilaterales con α = 0.05', () => {
    expect(redondear(tCritico(0.05, 1), 3)).toBe(12.706);
    expect(redondear(tCritico(0.05, 9), 3)).toBe(2.262);
    expect(redondear(tCritico(0.05, 29), 3)).toBe(2.045);
    expect(redondear(tCritico(0.05, 39), 3)).toBe(2.023);
    expect(redondear(tCritico(0.01, 20), 3)).toBe(2.845);
  });

  it('p-valor bilateral en el valor crítico es α', () => {
    expect(tPValorBilateral(2.262157, 9)).toBeCloseTo(0.05, 5);
    expect(tPValorBilateral(0, 10)).toBeCloseTo(1, 10);
  });

  it('intervalo de confianza t y prueba de Welch', () => {
    const ic = intervaloConfianzaT([1, 2, 3, 4, 5]);
    expect(ic?.media).toBe(3);
    // margen = t(0.975; 4) · s / √n = 2.776 · 1.5811 / 2.2361
    expect(redondear(ic?.margen ?? 0, 3)).toBe(1.963);
    const w = pruebaTWelch([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
    expect(redondear(w?.t ?? 0, 3)).toBe(1.897);
    expect(redondear(w?.gl ?? 0, 3)).toBe(5.882);
  });
});

describe('Pruebas sobre números pseudoaleatorios', () => {
  it('corridas: una secuencia alternante tiene el máximo de corridas', () => {
    const r = pruebaCorridas([0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9]);
    expect(r.corridas).toBe(7);
  });

  it('bondad de ajuste: frecuencias iguales a las esperadas dan χ² = 0', () => {
    const b = bondadAjuste([25, 25, 50], [0.25, 0.25, 0.5]);
    expect(b.estadistico).toBe(0);
    expect(b.gl).toBe(2);
    expect(b.ajusta).toBe(true);
  });
});

describe('Descriptivos', () => {
  it('media, mediana, desviación muestral y cuartiles interpolados (CUARTIL.INC)', () => {
    const d = descriptivos([4, 1, 3, 2]);
    expect(d).not.toBeNull();
    expect(d?.media).toBe(2.5);
    expect(d?.mediana).toBe(2.5);
    expect(d?.q1).toBe(1.75);
    expect(d?.q3).toBe(3.25);
    expect(redondear(d?.desviacion ?? 0, 4)).toBe(1.291);
    expect(d?.rango).toBe(3);
  });

  it('devuelve null sin datos y desviación 0 con un solo dato', () => {
    expect(descriptivos([])).toBeNull();
    expect(descriptivos([7])?.desviacion).toBe(0);
  });
});

describe('Frecuencias y alerta de concentración', () => {
  it('respeta el orden del catálogo, incluye categorías con n = 0 y excluye vacíos', () => {
    const t = frecuencias(['B', 'A', 'B', undefined], ['A', 'B', 'C'] as const);
    expect(t.total).toBe(3);
    expect(t.filas.map((f) => [f.categoria, f.n])).toEqual([['A', 1], ['B', 2], ['C', 0]]);
    expect(redondear(concentracionPrincipales(t, 2).porcentaje, 1)).toBe(100);
  });

  it('regla del 70 %: alerta si supera, "cerca" a menos de 5 puntos', () => {
    expect(evaluarConcentracion(75)).toBe('alerta');
    expect(evaluarConcentracion(70)).toBe('cerca');
    expect(evaluarConcentracion(67.5)).toBe('cerca');
    expect(evaluarConcentracion(64.9)).toBe('normal');
  });
});

describe('Pruebas de independencia', () => {
  it('Fisher: ejemplo clásico de la catadora de té [[3,1],[1,3]]', () => {
    const f = fisherExacto2x2([[3, 1], [1, 3]]);
    expect(redondear(f.pValor, 4)).toBe(0.4857);
    expect(redondear(f.pDerecha, 4)).toBe(0.2429);
  });

  it('chi-cuadrado sin corrección y con Yates en una 2×2', () => {
    const sin = chiCuadrado([[10, 20], [20, 10]]);
    const yates = chiCuadrado([[10, 20], [20, 10]], { yates: true });
    expect(redondear(sin?.estadistico ?? 0, 4)).toBe(6.6667);
    expect(redondear(yates?.estadistico ?? 0, 4)).toBe(5.4);
    expect(sin?.gl).toBe(1);
    expect(sin?.correccionYates).toBe(false);
    expect(yates?.correccionYates).toBe(true);
  });

  it('Yates solo se aplica a tablas 2×2', () => {
    expect(chiCuadrado([[10, 20, 5], [20, 10, 5]], { yates: true })?.correccionYates).toBe(false);
  });

  it('cuenta las celdas con frecuencia esperada < 5', () => {
    expect(chiCuadrado([[1, 9], [9, 1]])?.celdasEsperadaMenor5).toBe(0);
    expect(chiCuadrado([[1, 3], [3, 1]])?.celdasEsperadaMenor5).toBe(4);
  });

  it('no calcula con filas o columnas en cero', () => {
    expect(chiCuadrado([[0, 0], [3, 4]])).toBeNull();
    expect(chiCuadrado([[5]])).toBeNull();
  });

  it('elige Fisher como oficial si hay E < 5, y Yates si no', () => {
    const conEMenor5 = pruebaIndependencia(crearTablaCruzada(['a', 'b'], ['x', 'y'], [[8, 1], [2, 6]]));
    const sinEMenor5 = pruebaIndependencia(crearTablaCruzada(['a', 'b'], ['x', 'y'], [[30, 10], [10, 30]]));
    expect(conEMenor5?.metodoOficial).toBe('fisher');
    expect(conEMenor5?.pValorOficial).toBe(conEMenor5?.fisher?.pValor);
    expect(sinEMenor5?.metodoOficial).toBe('yates');
    expect(sinEMenor5?.pValorOficial).toBe(sinEMenor5?.yates?.pValor);
  });
});

describe('Likert e índice de acuerdo (Ecuación 2)', () => {
  it('estadísticos Likert ignoran vacíos', () => {
    const e = estadisticosLikert([1, 3, 4, 4, undefined]);
    expect(e?.n).toBe(4);
    expect(e?.media).toBe(3);
    expect(e?.porcentajeAcuerdo).toBe(75);
    expect(e?.distribucion).toEqual([1, 0, 1, 2]);
  });

  it('el índice excluye "No sabe" y vacíos del denominador', () => {
    const i = indiceAcuerdo(['Totalmente de acuerdo', 'Parcialmente de acuerdo', 'Totalmente en desacuerdo', 'No sabe', undefined]);
    expect(i.nValidas).toBe(3);
    expect(i.indice).toBe(50);
    expect(indiceAcuerdo(['No sabe']).indice).toBeNull();
  });
});
