/**
 * Simulación de escenarios de decisión con el generador congruencial mixto de la materia
 * (Coss Bu, 2003): X(n+1) = (a · X(n) + c) mod m, con a = 8121, c = 28411 y m = 100 000.
 *
 * Reglas:
 * - Cada ejecución de un escenario usa como máximo un período del generador (100 000 números)
 *   para no repetir la secuencia; si se piden más réplicas, se ajustan y se informa.
 * - Cada titulado simulado consume un solo número U: su resultado se obtiene por transformada
 *   inversa sobre la distribución conjunta de sus decisiones.
 * - Las semillas son fijas (reproducibles); no se usa Math.random().
 * - Las probabilidades salen de la base activa; los supuestos del informe son editables.
 */

import type { Titulado } from '../types';
import { AREAS_POSGRADO, TIEMPOS_PRIMER_EMPLEO, type AreaPosgrado, type TiempoPrimerEmpleo } from '../data/catalogos';
import { analizarDemandaPosgrado, analizarMercadoTitulados } from './analisis';
import {
  bondadAjuste,
  intervaloConfianzaT,
  pruebaCorridas,
  pruebaTWelch,
  type IntervaloConfianza,
  type ResultadoBondadAjuste,
  type ResultadoCorridas,
  type ResultadoWelch
} from './estadistica';

// ---------------------------------------------------------------------------
// Generador congruencial mixto
// ---------------------------------------------------------------------------

export const PARAMETROS_GENERADOR = { a: 8121, c: 28411, m: 100000 } as const;
/** Período completo del generador (cumple las condiciones de Hull-Dobell). */
export const PERIODO = PARAMETROS_GENERADOR.m;

export class GeneradorCongruencial {
  private x: number;
  readonly semilla: number;
  /** Números U generados desde la creación. */
  usados = 0;

  constructor(semilla: number) {
    this.semilla = Math.abs(Math.floor(semilla)) % PARAMETROS_GENERADOR.m;
    this.x = this.semilla;
  }

  /** Último X generado (sirve como semilla de la ejecución siguiente). */
  get ultimoX(): number {
    return this.x;
  }

  /** Siguiente número U(0, 1) = X / m. */
  siguiente(): number {
    const { a, c, m } = PARAMETROS_GENERADOR;
    this.x = (a * this.x + c) % m;
    this.usados++;
    return this.x / m;
  }

  /** Transformada inversa discreta: devuelve la primera categoría cuya probabilidad acumulada supera U. */
  transformadaInversa<T>(categorias: Array<{ valor: T; probabilidad: number }>): T {
    const u = this.siguiente();
    let acumulada = 0;
    for (const c of categorias) {
      acumulada += c.probabilidad;
      if (u < acumulada) return c.valor;
    }
    return categorias[categorias.length - 1].valor;
  }
}

// ---------------------------------------------------------------------------
// Parámetros tomados de la base
// ---------------------------------------------------------------------------

export interface Probabilidad {
  valor: number;
  n: number;
  total: number;
}

export interface ParametrosBase {
  /** P(interés en un posgrado). */
  interes: Probabilidad;
  /** Distribución del área de interés entre los interesados. */
  areas: Array<{ area: AreaPosgrado; probabilidad: number; n: number }>;
  totalAreas: number;
  /** P(prefiere el Posgrado FCyT) entre los interesados. */
  fcyt: Probabilidad;
  /** Proporción actual de posgrados financiados con beca. */
  becaActual: Probabilidad;
  /** Distribución real del tiempo para conseguir el primer empleo. */
  tiempos: Array<{ categoria: TiempoPrimerEmpleo; probabilidad: number; n: number }>;
  totalTiempos: number;
}

const prob = (n: number, total: number): Probabilidad => ({ valor: total > 0 ? n / total : 0, n, total });

export function parametrosDesdeBase(titulados: Titulado[]): ParametrosBase {
  const posgrado = analizarDemandaPosgrado(titulados);
  const mercado = analizarMercadoTitulados(titulados);
  const fcyt = posgrado.instituciones.filas.find((f) => f.categoria === 'Posgrado FCyT')?.n ?? 0;
  return {
    interes: prob(posgrado.interesados.n, posgrado.interesados.total),
    areas: posgrado.areas.filas.map((f) => ({ area: f.categoria, probabilidad: f.porcentaje / 100, n: f.n })),
    totalAreas: posgrado.areas.total,
    fcyt: prob(fcyt, posgrado.instituciones.total),
    becaActual: prob(posgrado.conBeca.n, posgrado.conBeca.total),
    tiempos: mercado.tiempos.filas.map((f) => ({ categoria: f.categoria, probabilidad: f.porcentaje / 100, n: f.n })),
    totalTiempos: mercado.tiempos.total
  };
}

/** Réplicas que caben en un período, dado el consumo por réplica. */
function ajustarReplicas(pedidas: number, consumoPorReplica: number) {
  const maximo = Math.max(2, Math.floor(PERIODO / consumoPorReplica));
  const replicas = Math.max(2, Math.min(Math.floor(pedidas), maximo));
  return { replicas, maximo, ajustado: replicas !== Math.floor(pedidas) };
}

export interface Consumo {
  usados: number;
  periodo: number;
  /** El número de réplicas pedido no cabía en un período y se redujo. */
  replicasAjustadas: boolean;
  replicasPedidas: number;
  replicasMaximas: number;
  /** Semilla sugerida para la próxima ejecución (último X generado). */
  siguienteSemilla: number;
}

// ---------------------------------------------------------------------------
// Escenario A: viabilidad de nuevos posgrados en la FCyT
// ---------------------------------------------------------------------------

export interface SupuestosA {
  poblacion: number;
  replicas: number;
  /** P(se inscribe | prefiere la FCyT). Supuesto del informe: 35 %. */
  conversion: number;
  /** Mínimo de inscritos para que un programa sea sostenible. */
  umbral: number;
  semilla: number;
}

export type Decision = 'Viable' | 'Viable con apoyo' | 'Integrar como módulo';

export interface ResultadoAreaA {
  area: AreaPosgrado;
  ic: IntervaloConfianza | null;
  /** Valor esperado analítico: N · P(interés) · P(área) · P(FCyT) · conversión. */
  esperado: number;
  /** Porcentaje de réplicas que alcanzan el umbral. */
  probabilidadUmbral: number;
  decision: Decision;
  porReplica: number[];
}

export interface ResultadoA {
  areas: ResultadoAreaA[];
  replicas: number;
  /** Interesados simulados por área (todas las réplicas), para validar contra la base. */
  interesadosPorArea: number[];
  ajusteAreas: ResultadoBondadAjuste;
  consumo: Consumo;
}

type ResultadoTitulado = { tipo: 'no-interesado' } | { tipo: 'interesado'; area: number; destino: 'otra' | 'fcyt' | 'inscrito' };

export function simularEscenarioA(base: ParametrosBase, s: SupuestosA): ResultadoA {
  const { replicas, maximo, ajustado } = ajustarReplicas(s.replicas, s.poblacion);
  const gen = new GeneradorCongruencial(s.semilla);
  const pI = base.interes.valor;
  const pF = base.fcyt.valor;

  // Distribución conjunta de un titulado: interés × área × destino (independientes, como en el informe)
  const categorias: Array<{ valor: ResultadoTitulado; probabilidad: number }> = [{ valor: { tipo: 'no-interesado' }, probabilidad: 1 - pI }];
  base.areas.forEach((a, i) => {
    categorias.push({ valor: { tipo: 'interesado', area: i, destino: 'otra' }, probabilidad: pI * a.probabilidad * (1 - pF) });
    categorias.push({ valor: { tipo: 'interesado', area: i, destino: 'fcyt' }, probabilidad: pI * a.probabilidad * pF * (1 - s.conversion) });
    categorias.push({ valor: { tipo: 'interesado', area: i, destino: 'inscrito' }, probabilidad: pI * a.probabilidad * pF * s.conversion });
  });

  const porReplica = base.areas.map(() => [] as number[]);
  const interesadosPorArea = base.areas.map(() => 0);
  for (let r = 0; r < replicas; r++) {
    const inscritos = base.areas.map(() => 0);
    for (let i = 0; i < s.poblacion; i++) {
      const t = gen.transformadaInversa(categorias);
      if (t.tipo === 'interesado') {
        interesadosPorArea[t.area]++;
        if (t.destino === 'inscrito') inscritos[t.area]++;
      }
    }
    inscritos.forEach((n, k) => porReplica[k].push(n));
  }

  const areas = base.areas.map((a, k): ResultadoAreaA => {
    const valores = porReplica[k];
    const alcanzan = valores.filter((v) => v >= s.umbral).length;
    const probabilidadUmbral = (100 * alcanzan) / valores.length;
    const decision: Decision = probabilidadUmbral >= 80 ? 'Viable' : probabilidadUmbral >= 50 ? 'Viable con apoyo' : 'Integrar como módulo';
    return {
      area: a.area,
      ic: intervaloConfianzaT(valores),
      esperado: s.poblacion * pI * a.probabilidad * pF * s.conversion,
      probabilidadUmbral,
      decision,
      porReplica: valores
    };
  });

  return {
    areas,
    replicas,
    interesadosPorArea,
    ajusteAreas: bondadAjuste(interesadosPorArea, base.areas.map((a) => a.probabilidad)),
    consumo: {
      usados: gen.usados,
      periodo: PERIODO,
      replicasAjustadas: ajustado,
      replicasPedidas: s.replicas,
      replicasMaximas: maximo,
      siguienteSemilla: gen.ultimoX
    }
  };
}

// ---------------------------------------------------------------------------
// Escenario B: convenios de becas
// ---------------------------------------------------------------------------

export interface SupuestosB {
  poblacion: number;
  replicas: number;
  /** Misma conversión del escenario A: P(inscribirse sin beca) = P(FCyT) · conversión. */
  conversion: number;
  /** Cuántas veces aumenta la probabilidad de inscribirse con beca. Supuesto del informe: 2. */
  multiplicadorBeca: number;
  /** Proporción de becados con convenios. Meta del plan de acción: 30 %. */
  metaBecas: number;
  semilla: number;
}

export interface ResultadoB {
  probabilidadSinBeca: number;
  probabilidadConBeca: number;
  actual: IntervaloConfianza | null;
  convenio: IntervaloConfianza | null;
  esperadoActual: number;
  esperadoConvenio: number;
  /** Convenio − actual, con prueba t de Welch. */
  diferencia: ResultadoWelch | null;
  incremento: number;
  replicas: number;
  porReplicaActual: number[];
  porReplicaConvenio: number[];
  consumo: Consumo;
}

export function simularEscenarioB(base: ParametrosBase, s: SupuestosB): ResultadoB {
  const { replicas, maximo, ajustado } = ajustarReplicas(s.replicas, 2 * s.poblacion);
  const gen = new GeneradorCongruencial(s.semilla);
  const pI = base.interes.valor;
  const pSin = base.fcyt.valor * s.conversion;
  const pCon = Math.min(1, pSin * s.multiplicadorBeca);

  // Un titulado: no interesado / interesado con o sin beca, que se inscribe o no
  const distribucion = (pBeca: number) => [
    { valor: false, probabilidad: 1 - pI },
    { valor: true, probabilidad: pI * pBeca * pCon },
    { valor: false, probabilidad: pI * pBeca * (1 - pCon) },
    { valor: true, probabilidad: pI * (1 - pBeca) * pSin },
    { valor: false, probabilidad: pI * (1 - pBeca) * (1 - pSin) }
  ];
  const actualDist = distribucion(base.becaActual.valor);
  const convenioDist = distribucion(s.metaBecas);
  const contar = (dist: Array<{ valor: boolean; probabilidad: number }>) => {
    let n = 0;
    for (let i = 0; i < s.poblacion; i++) if (gen.transformadaInversa(dist)) n++;
    return n;
  };

  const porReplicaActual: number[] = [];
  const porReplicaConvenio: number[] = [];
  for (let r = 0; r < replicas; r++) {
    porReplicaActual.push(contar(actualDist));
    porReplicaConvenio.push(contar(convenioDist));
  }

  const esperado = (pBeca: number) => s.poblacion * pI * (pBeca * pCon + (1 - pBeca) * pSin);
  const actual = intervaloConfianzaT(porReplicaActual);
  const convenio = intervaloConfianzaT(porReplicaConvenio);
  return {
    probabilidadSinBeca: pSin,
    probabilidadConBeca: pCon,
    actual,
    convenio,
    esperadoActual: esperado(base.becaActual.valor),
    esperadoConvenio: esperado(s.metaBecas),
    diferencia: pruebaTWelch(porReplicaActual, porReplicaConvenio),
    incremento: actual && convenio && actual.media > 0 ? (100 * (convenio.media - actual.media)) / actual.media : 0,
    replicas,
    porReplicaActual,
    porReplicaConvenio,
    consumo: {
      usados: gen.usados,
      periodo: PERIODO,
      replicasAjustadas: ajustado,
      replicasPedidas: s.replicas,
      replicasMaximas: maximo,
      siguienteSemilla: gen.ultimoX
    }
  };
}

// ---------------------------------------------------------------------------
// Escenario C: pasantías e inserción laboral
// ---------------------------------------------------------------------------

/** Categorías de inserción rápida (4 meses o menos, incluye a quienes ya trabajaban). */
export const TIEMPOS_RAPIDOS: readonly TiempoPrimerEmpleo[] = ['Ya trabajaba antes de titularse', 'Menos de 1 mes', 'Entre 1 - 4 meses'];

export interface SupuestosC {
  poblacion: number;
  replicas: number;
  /** Fracción de quienes tardan más de 4 meses que pasa a "ya trabajaba". Supuesto del informe: 50 %. */
  reduccion: number;
  semilla: number;
}

export interface ResultadoC {
  categorias: Array<{ categoria: TiempoPrimerEmpleo; probabilidadReal: number; probabilidadSimulada: number; pctReal: number; pctSimulado: number }>;
  rapidaReal: IntervaloConfianza | null;
  rapidaSimulada: IntervaloConfianza | null;
  diferencia: ResultadoWelch | null;
  ajusteReal: ResultadoBondadAjuste;
  replicas: number;
  consumo: Consumo;
}

export function simularEscenarioC(base: ParametrosBase, s: SupuestosC): ResultadoC {
  const { replicas, maximo, ajustado } = ajustarReplicas(s.replicas, 2 * s.poblacion);
  const gen = new GeneradorCongruencial(s.semilla);
  const k = base.tiempos.length;
  const real = base.tiempos.map((t) => t.probabilidad);
  const lentos = base.tiempos.map((t) => !TIEMPOS_RAPIDOS.includes(t.categoria));
  const trasladado = real.reduce((sum, p, i) => sum + (lentos[i] ? p * s.reduccion : 0), 0);
  const simulada = real.map((p, i) => (lentos[i] ? p * (1 - s.reduccion) : i === 0 ? p + trasladado : p));

  const distReal = real.map((probabilidad, i) => ({ valor: i, probabilidad }));
  const distSim = simulada.map((probabilidad, i) => ({ valor: i, probabilidad }));
  const totalReal = new Array<number>(k).fill(0);
  const totalSim = new Array<number>(k).fill(0);
  const rapidaReal: number[] = [];
  const rapidaSim: number[] = [];

  for (let r = 0; r < replicas; r++) {
    let rapidosReal = 0;
    let rapidosSim = 0;
    for (let i = 0; i < s.poblacion; i++) {
      const c = gen.transformadaInversa(distReal);
      totalReal[c]++;
      if (!lentos[c]) rapidosReal++;
    }
    for (let i = 0; i < s.poblacion; i++) {
      const c = gen.transformadaInversa(distSim);
      totalSim[c]++;
      if (!lentos[c]) rapidosSim++;
    }
    rapidaReal.push((100 * rapidosReal) / s.poblacion);
    rapidaSim.push((100 * rapidosSim) / s.poblacion);
  }

  const n = replicas * s.poblacion;
  return {
    categorias: base.tiempos.map((t, i) => ({
      categoria: t.categoria,
      probabilidadReal: real[i],
      probabilidadSimulada: simulada[i],
      pctReal: (100 * totalReal[i]) / n,
      pctSimulado: (100 * totalSim[i]) / n
    })),
    rapidaReal: intervaloConfianzaT(rapidaReal),
    rapidaSimulada: intervaloConfianzaT(rapidaSim),
    diferencia: pruebaTWelch(rapidaReal, rapidaSim),
    ajusteReal: bondadAjuste(totalReal, real),
    replicas,
    consumo: {
      usados: gen.usados,
      periodo: PERIODO,
      replicasAjustadas: ajustado,
      replicasPedidas: s.replicas,
      replicasMaximas: maximo,
      siguienteSemilla: gen.ultimoX
    }
  };
}

// ---------------------------------------------------------------------------
// Validación del generador
// ---------------------------------------------------------------------------

export interface ValidacionGenerador {
  semilla: number;
  primeros: Array<{ paso: number; x: number; u: number }>;
  /** Período medido: pasos hasta volver al primer X generado. */
  periodo: number;
  muestra: number;
  media: number;
  varianza: number;
  uniformidad: ResultadoBondadAjuste;
  corridas: ResultadoCorridas;
}

export function validarGenerador(semilla: number, muestra = 10000): ValidacionGenerador {
  const gen = new GeneradorCongruencial(semilla);
  const primeros = Array.from({ length: 8 }, (_, i) => {
    const u = gen.siguiente();
    return { paso: i + 1, x: gen.ultimoX, u };
  });

  const ciclo = new GeneradorCongruencial(semilla);
  ciclo.siguiente();
  const inicio = ciclo.ultimoX;
  let periodo = 0;
  do {
    ciclo.siguiente();
    periodo++;
  } while (ciclo.ultimoX !== inicio && periodo <= PERIODO);

  const g = new GeneradorCongruencial(semilla);
  const u = Array.from({ length: muestra }, () => g.siguiente());
  const media = u.reduce((s, v) => s + v, 0) / muestra;
  const varianza = u.reduce((s, v) => s + (v - media) ** 2, 0) / (muestra - 1);
  const clases = new Array<number>(10).fill(0);
  for (const v of u) clases[Math.min(9, Math.floor(v * 10))]++;

  return {
    semilla: gen.semilla,
    primeros,
    periodo,
    muestra,
    media,
    varianza,
    uniformidad: bondadAjuste(clases, new Array(10).fill(0.1)),
    corridas: pruebaCorridas(u)
  };
}

/** Supuestos del informe y semillas fijas: valores iniciales de la pestaña y del informe PDF. */
export const SUPUESTOS_INFORME: { A: SupuestosA; B: SupuestosB; C: SupuestosC } = {
  A: { poblacion: 1000, replicas: 40, conversion: 0.35, umbral: 15, semilla: 45217 },
  B: { poblacion: 1000, replicas: 30, conversion: 0.35, multiplicadorBeca: 2, metaBecas: 0.3, semilla: 78901 },
  C: { poblacion: 1000, replicas: 40, reduccion: 0.5, semilla: 24680 }
};

/** Áreas y tiempos en el orden del catálogo (para las etiquetas de la interfaz). */
export const ORDEN_AREAS = AREAS_POSGRADO;
export const ORDEN_TIEMPOS = TIEMPOS_PRIMER_EMPLEO;
