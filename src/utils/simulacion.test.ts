import { describe, expect, it } from 'vitest';
import { redondear } from './estadistica';
import { leerBaseRealLocal } from './baseRealLocal';
import {
  GeneradorCongruencial,
  parametrosDesdeBase,
  PERIODO,
  simularEscenarioA,
  simularEscenarioB,
  simularEscenarioC,
  validarGenerador
} from './simulacion';

const base = await leerBaseRealLocal();
const parametros = parametrosDesdeBase(base.titulados ?? []);

describe('Generador congruencial mixto (a = 8121, c = 28411, m = 100 000)', () => {
  it('X1 = (8121 · 45217 + 28411) mod 100 000 = 35668', () => {
    const g = new GeneradorCongruencial(45217);
    expect(g.siguiente()).toBe(0.35668);
    expect(g.ultimoX).toBe(35668);
    expect(g.usados).toBe(1);
  });

  it('tiene período completo y pasa las pruebas de uniformidad e independencia', () => {
    const v = validarGenerador(45217);
    expect(v.periodo).toBe(PERIODO);
    expect(Math.abs(v.media - 0.5)).toBeLessThan(0.01);
    expect(Math.abs(v.varianza - 1 / 12)).toBeLessThan(0.005);
    expect(v.uniformidad.ajusta).toBe(true);
    expect(v.corridas.independiente).toBe(true);
  });
});

describe('Parámetros tomados de la base', () => {
  it('P(interés) = 155/184, P(FCyT) = 48/155, beca actual = 8/119 y tiempos sobre 134', () => {
    expect([parametros.interes.n, parametros.interes.total, redondear(parametros.interes.valor, 3)]).toEqual([155, 184, 0.842]);
    expect([parametros.fcyt.n, parametros.fcyt.total, redondear(parametros.fcyt.valor, 3)]).toEqual([48, 155, 0.31]);
    expect([parametros.becaActual.n, parametros.becaActual.total, redondear(parametros.becaActual.valor, 3)]).toEqual([8, 119, 0.067]);
    expect(parametros.areas.map((a) => redondear(a.probabilidad, 3))).toEqual([0.452, 0.239, 0.206, 0.071, 0.032]);
    expect(parametros.totalTiempos).toBe(134);
  });
});

describe('Escenario A: viabilidad de posgrados', () => {
  const supuestos = { poblacion: 1000, replicas: 40, conversion: 0.35, umbral: 15, semilla: 45217 };
  const a = simularEscenarioA(parametros, supuestos);

  it('consume un número por titulado y no supera el período', () => {
    expect(a.consumo.usados).toBe(40000);
    expect(a.consumo.usados).toBeLessThanOrEqual(PERIODO);
  });

  it('es reproducible con la misma semilla', () => {
    expect(simularEscenarioA(parametros, supuestos).areas.map((r) => r.ic?.media)).toEqual(a.areas.map((r) => r.ic?.media));
  });

  it('las medias simuladas están cerca del valor esperado analítico', () => {
    for (const r of a.areas) {
      const errorEstandar = (r.ic?.desviacion ?? 0) / Math.sqrt(a.replicas);
      expect(Math.abs((r.ic?.media ?? 0) - r.esperado)).toBeLessThan(4 * errorEstandar + 0.5);
    }
  });

  it('reproduce la distribución de áreas de la base (bondad de ajuste)', () => {
    expect(a.ajusteAreas.ajusta).toBe(true);
  });

  it('ajusta las réplicas si no caben en el período', () => {
    const grande = simularEscenarioA(parametros, { ...supuestos, replicas: 500 });
    expect(grande.consumo.replicasAjustadas).toBe(true);
    expect(grande.replicas).toBe(100);
    expect(grande.consumo.usados).toBe(PERIODO);
  });
});

describe('Escenario B: convenios de becas', () => {
  const b = simularEscenarioB(parametros, {
    poblacion: 1000,
    replicas: 30,
    conversion: 0.35,
    multiplicadorBeca: 2,
    metaBecas: 0.3,
    semilla: 78901
  });

  it('P(inscribirse sin beca) = P(FCyT) · conversión ≈ 0.108', () => {
    expect(redondear(b.probabilidadSinBeca, 3)).toBe(0.108);
    expect(redondear(b.probabilidadConBeca, 3)).toBe(0.217);
  });

  it('consume dos números por titulado (situación actual y con convenios)', () => {
    expect(b.consumo.usados).toBe(60000);
  });

  it('con convenios la matrícula aumenta de forma significativa', () => {
    expect(b.convenio?.media ?? 0).toBeGreaterThan(b.actual?.media ?? 0);
    expect(b.diferencia?.pValor ?? 1).toBeLessThan(0.05);
    expect(Math.abs((b.actual?.media ?? 0) - b.esperadoActual)).toBeLessThan(5);
  });
});

describe('Escenario C: pasantías', () => {
  const c = simularEscenarioC(parametros, { poblacion: 1000, replicas: 40, reduccion: 0.5, semilla: 24680 });

  it('las probabilidades simuladas suman 1 y la inserción rápida mejora', () => {
    expect(c.categorias.reduce((s, x) => s + x.probabilidadSimulada, 0)).toBeCloseTo(1, 10);
    expect(c.rapidaSimulada?.media ?? 0).toBeGreaterThan(c.rapidaReal?.media ?? 0);
    expect(c.consumo.usados).toBe(80000);
  });

  it('la situación real simulada reproduce la distribución de la base', () => {
    expect(c.ajusteReal.ajusta).toBe(true);
    // 99 de 134 titulados consiguieron empleo en 4 meses o menos (73,88 %)
    expect(Math.abs((c.rapidaReal?.media ?? 0) - 73.88)).toBeLessThan(1);
  });
});
