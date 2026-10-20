import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { redondear } from './estadistica';
import { importarArchivo } from './importador';
import {
  GeneradorCongruencial,
  parametrosDesdeBase,
  PERIODO,
  simularEscenarioA,
  simularEscenarioB,
  simularEscenarioC,
  validarGenerador
} from './simulacion';

const buffer = readFileSync(resolve(import.meta.dirname, '../../public/data/Base_Limpia_Titulados_Empleadores.xlsx'));
const base = await importarArchivo(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer, 'base.xlsx');
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
  it('P(interés) = 122/147, P(FCyT) = 38/123, beca actual = 8/98 y tiempos sobre 101', () => {
    expect([parametros.interes.n, parametros.interes.total, redondear(parametros.interes.valor, 3)]).toEqual([122, 147, 0.83]);
    expect([parametros.fcyt.n, parametros.fcyt.total, redondear(parametros.fcyt.valor, 3)]).toEqual([38, 123, 0.309]);
    expect([parametros.becaActual.n, parametros.becaActual.total, redondear(parametros.becaActual.valor, 3)]).toEqual([8, 98, 0.082]);
    expect(parametros.areas.map((a) => redondear(a.probabilidad, 3))).toEqual([0.439, 0.236, 0.203, 0.081, 0.041]);
    expect(parametros.totalTiempos).toBe(101);
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
    expect(redondear(b.probabilidadConBeca, 3)).toBe(0.216);
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
    expect(Math.abs((c.rapidaReal?.media ?? 0) - 76.24)).toBeLessThan(1);
  });
});
