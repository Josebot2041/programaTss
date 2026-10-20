/**
 * Análisis de cada historia de usuario sobre los registros cargados.
 * Usa las funciones puras de `estadistica.ts` y las categorías de `catalogos.ts`.
 */

import {
  AREAS_POSGRADO,
  ASIGNATURAS_NO_UTILES,
  ASIGNATURAS_VENTAJA,
  ASPECTOS_MEJORAR,
  ASPECTOS_UTILES,
  EDADES,
  FINANCIAMIENTOS,
  GENEROS,
  INSTITUCIONES_PREFERIDAS,
  LUGARES_POSGRADO,
  NIVELES_POSGRADO,
  CARGOS_EMPLEADOR,
  CARGOS_TITULADO,
  DEPARTAMENTOS,
  FINANCIAMIENTOS_NEGOCIO,
  IMPORTANCIAS_FORMACION,
  MEDIOS_CONVOCATORIA,
  NIVELES_DEMANDADOS,
  ORIGENES_EMPRENDIMIENTO,
  POSIBILIDADES_CONTRATACION,
  RAZONES_NO_TRABAJA,
  REMUNERACIONES,
  REMUNERACIONES_ALTAS,
  RUBROS_EMPLEADOR,
  RUBROS_TITULADO,
  SATISFACCIONES_NEGOCIO,
  SECTORES,
  SITUACIONES_LABORALES,
  TAMANOS_EMPRESA,
  TIEMPOS_PRIMER_EMPLEO,
  TIPOS_ORGANIZACION,
  type NivelPosgrado,
  type Financiamiento,
  type Remuneracion
} from '../data/catalogos';
import { DIMENSIONES_EMPLEADORES } from '../data/strategicPlan';
import type { Empleador, Titulado } from '../types';
import {
  concentracionPrincipales,
  descriptivos,
  estadisticosLikert,
  evaluarConcentracion,
  frecuencias,
  frecuenciasMultiples,
  indiceAcuerdo,
  tablaCruzada,
  type Concentracion,
  type Descriptivos,
  type EstadisticosLikert,
  type IndiceAcuerdo,
  type NivelAlerta,
  type TablaCruzada,
  type TablaFrecuencias
} from './estadistica';
import { clasificarRespuestas, TEMAS_HABILIDADES, TEMAS_TECNOLOGIA } from './textoAbierto';

// ---------------------------------------------------------------------------
// HU1: años de vida profesional y segmentación
// ---------------------------------------------------------------------------

export interface AnalisisVidaProfesional {
  general: Descriptivos | null;
  junior: Descriptivos | null;
  consolidado: Descriptivos | null;
  /** Titulados sin dato de años de vida profesional. */
  sinDato: number;
}

export function analizarVidaProfesional(titulados: Titulado[]): AnalisisVidaProfesional {
  const anios = (lista: Titulado[]) =>
    lista.map((t) => t.anios_vida_profesional).filter((v): v is number => v !== undefined);
  return {
    general: descriptivos(anios(titulados)),
    junior: descriptivos(anios(titulados.filter((t) => t.segmento === 'Junior (< 5 años)'))),
    consolidado: descriptivos(anios(titulados.filter((t) => t.segmento === 'Consolidado (≥ 5 años)'))),
    sinDato: titulados.filter((t) => t.anios_vida_profesional === undefined).length
  };
}

/** Proporción de un subconjunto: n de total. */
export interface Proporcion {
  n: number;
  total: number;
  porcentaje: number;
}

const proporcion = (n: number, total: number): Proporcion => ({ n, total, porcentaje: total > 0 ? (100 * n) / total : 0 });

export interface AnalisisDesempleo {
  /** Tiempo cesante de todos los titulados con dato válido, incluidos los ceros. */
  tiempoCesante: Descriptivos | null;
  /** Σ años desempleado / Σ años de vida profesional × 100 (filas con ambos datos y vida > 0). */
  tasaSobreTrayectoria: number | null;
  /** Nunca estuvo desempleado (0 años), sobre quienes respondieron. */
  nuncaDesempleado: Proporcion;
  /** Acumula menos de un año sin empleo, sobre quienes respondieron. */
  menosDeUnAnio: Proporcion;
}

export function analizarDesempleo(titulados: Titulado[]): AnalisisDesempleo {
  const anios = titulados.map((t) => t.anios_desempleado).filter((v): v is number => v !== undefined);
  const conAmbos = titulados.filter(
    (t) => t.anios_desempleado !== undefined && t.anios_vida_profesional !== undefined && t.anios_vida_profesional > 0
  );
  const sumaDesempleo = conAmbos.reduce((s, t) => s + (t.anios_desempleado ?? 0), 0);
  const sumaVida = conAmbos.reduce((s, t) => s + (t.anios_vida_profesional ?? 0), 0);
  return {
    tiempoCesante: descriptivos(anios),
    tasaSobreTrayectoria: sumaVida > 0 ? (100 * sumaDesempleo) / sumaVida : null,
    nuncaDesempleado: proporcion(anios.filter((v) => v === 0).length, anios.length),
    menosDeUnAnio: proporcion(anios.filter((v) => v < 1).length, anios.length)
  };
}

// ---------------------------------------------------------------------------
// Perfil general
// ---------------------------------------------------------------------------

export function analizarPerfil(titulados: Titulado[]) {
  return {
    edades: frecuencias(titulados.map((t) => t.edad), EDADES),
    generos: frecuencias(titulados.map((t) => t.genero), GENEROS)
  };
}

// ---------------------------------------------------------------------------
// HU2: demanda de posgrado
// ---------------------------------------------------------------------------

/** Umbral de la alerta de concentración de HU2 (porcentaje de las 2 áreas principales). */
export const UMBRAL_CONCENTRACION = 70;

export interface AnalisisDemandaPosgrado {
  /** interes_posgrado = "Sí" sobre quienes respondieron la pregunta (es la p del escenario A). */
  interesados: Proporcion;
  areas: TablaFrecuencias<(typeof AREAS_POSGRADO)[number]>;
  concentracionAreas: Concentracion;
  /** La alerta se aplica al área de interés (decisión del grupo). */
  alertaAreas: NivelAlerta;
  instituciones: TablaFrecuencias<(typeof INSTITUCIONES_PREFERIDAS)[number]>;
  /** Titulados que ya cursaron formación complementaria de posgrado. */
  cursaron: Proporcion;
  niveles: TablaFrecuencias<NivelPosgrado>;
  /** Solo informativo: concentración de los 2 niveles de posgrado más cursados. */
  concentracionNiveles: Concentracion;
  lugares: TablaFrecuencias<(typeof LUGARES_POSGRADO)[number]>;
  financiamientos: TablaFrecuencias<Financiamiento>;
  /** Con beca parcial o total, sobre quienes informaron el financiamiento. */
  conBeca: Proporcion;
}

export function analizarDemandaPosgrado(titulados: Titulado[]): AnalisisDemandaPosgrado {
  const areas = frecuencias(titulados.map((t) => t.area_interes), AREAS_POSGRADO);
  const niveles = frecuencias(titulados.map((t) => t.nivel_realizado), NIVELES_POSGRADO);
  const financiamientos = frecuencias(titulados.map((t) => t.financiamiento), FINANCIAMIENTOS);
  const concentracionAreas = concentracionPrincipales(areas, 2);
  const respondieron = titulados.filter((t) => t.interes_posgrado !== undefined);
  const propios = financiamientos.filas.find((f) => f.categoria === 'Recursos propios')?.n ?? 0;
  return {
    interesados: proporcion(respondieron.filter((t) => t.interes_posgrado === 'Sí').length, respondieron.length),
    areas,
    concentracionAreas,
    alertaAreas: evaluarConcentracion(concentracionAreas.porcentaje, UMBRAL_CONCENTRACION),
    instituciones: frecuencias(titulados.map((t) => t.institucion_preferida), INSTITUCIONES_PREFERIDAS),
    cursaron: proporcion(titulados.filter((t) => t.formacion_complementaria === 'Sí').length, titulados.length),
    niveles,
    concentracionNiveles: concentracionPrincipales(niveles, 2),
    lugares: frecuencias(titulados.map((t) => t.lugar_realizado), LUGARES_POSGRADO),
    financiamientos,
    conBeca: proporcion(financiamientos.total - propios, financiamientos.total)
  };
}

// ---------------------------------------------------------------------------
// HU3: tablas cruzadas del informe
// ---------------------------------------------------------------------------

/** Agrupación del informe para el nivel del programa realizado. */
export const GRUPOS_NIVEL_HU3 = ['Diplomado', 'Especialidad / Maestría / Doctorado'] as const;
/** Agrupación del informe para la fuente de financiamiento. */
export const GRUPOS_FINANCIAMIENTO_HU3 = ['Recursos propios', 'Beca (parcial o total)'] as const;

export function grupoNivelHU3(nivel: NivelPosgrado | undefined): (typeof GRUPOS_NIVEL_HU3)[number] | undefined {
  if (nivel === undefined) return undefined;
  return nivel === 'Diplomado' ? 'Diplomado' : 'Especialidad / Maestría / Doctorado';
}

export function grupoFinanciamientoHU3(
  financiamiento: Financiamiento | undefined
): (typeof GRUPOS_FINANCIAMIENTO_HU3)[number] | undefined {
  if (financiamiento === undefined) return undefined;
  return financiamiento === 'Recursos propios' ? 'Recursos propios' : 'Beca (parcial o total)';
}

/** HU3: nivel del programa realizado (agrupado) × fuente de financiamiento (agrupada). */
export function tablaNivelFinanciamiento(titulados: Titulado[]): TablaCruzada {
  return tablaCruzada(
    titulados,
    (t) => grupoNivelHU3(t.nivel_realizado),
    (t) => grupoFinanciamientoHU3(t.financiamiento),
    GRUPOS_NIVEL_HU3,
    GRUPOS_FINANCIAMIENTO_HU3,
    false
  );
}

export const GRUPOS_REMUNERACION = ['≤ Bs. 7 000', '> Bs. 7 000'] as const;

export function grupoRemuneracion(r: Remuneracion | undefined): (typeof GRUPOS_REMUNERACION)[number] | undefined {
  if (r === undefined) return undefined;
  return REMUNERACIONES_ALTAS.includes(r) ? '> Bs. 7 000' : '≤ Bs. 7 000';
}

/** Sector (privado / público) × remuneración (≤ / > Bs. 7 000). */
export function tablaSectorRemuneracion(titulados: Titulado[]): TablaCruzada {
  return tablaCruzada(titulados, (t) => t.sector, (t) => grupoRemuneracion(t.remuneracion), SECTORES, GRUPOS_REMUNERACION, false);
}

export const GRUPOS_EDAD = ['30 años o menos', 'Más de 30 años'] as const;

export function grupoEdad(edad: Titulado['edad']): (typeof GRUPOS_EDAD)[number] {
  return edad === '31 - 34 años' || edad === '35 años o más' ? 'Más de 30 años' : '30 años o menos';
}

/** Edad (≤ 30 / > 30 años) × formación complementaria realizada. */
export function tablaEdadFormacion(titulados: Titulado[]): TablaCruzada {
  return tablaCruzada(titulados, (t) => grupoEdad(t.edad), (t) => t.formacion_complementaria, GRUPOS_EDAD, ['Sí', 'No'] as const, false);
}

export const GRUPOS_INSTITUCION = ['UMSS (FCyT o EUPG)', 'Universidad internacional', 'Otra nacional u otra'] as const;

export function grupoInstitucion(i: Titulado['institucion_preferida']): (typeof GRUPOS_INSTITUCION)[number] | undefined {
  if (i === undefined) return undefined;
  if (i === 'Posgrado FCyT' || i === 'EUPG') return 'UMSS (FCyT o EUPG)';
  if (i === 'Univ. internacionales') return 'Universidad internacional';
  return 'Otra nacional u otra';
}

/** Área de interés × institución preferida (agrupada en UMSS / internacional / otra). */
export function tablaAreaInstitucion(titulados: Titulado[]): TablaCruzada {
  return tablaCruzada(titulados, (t) => t.area_interes, (t) => grupoInstitucion(t.institucion_preferida), AREAS_POSGRADO, GRUPOS_INSTITUCION, false);
}

const AREAS_PRUEBA = ['IA', 'Ingeniería de Software', 'Redes de Datos y Seguridad', 'Base de Datos o Robótica'] as const;

/** Para la prueba chi-cuadrado se agrupan Base de Datos y Robótica (pocas respuestas), como en el informe. */
export function tablaAreaInstitucionPrueba(titulados: Titulado[]): TablaCruzada {
  return tablaCruzada(
    titulados,
    (t) => (t.area_interes === 'Base de Datos' || t.area_interes === 'Robótica' ? 'Base de Datos o Robótica' : t.area_interes),
    (t) => grupoInstitucion(t.institucion_preferida),
    AREAS_PRUEBA,
    GRUPOS_INSTITUCION,
    false
  );
}

export interface DefinicionPrueba {
  id: string;
  /** Nombre corto para selectores. */
  nombre: string;
  relacion: string;
  variableFilas: string;
  variableColumnas: string;
  /** Población sobre la que se cruza (para la fuente). */
  poblacion: string;
  construir: (titulados: Titulado[]) => TablaCruzada;
}

/** Pruebas de independencia de la Tabla 4 del informe. */
export const PRUEBAS_INDEPENDENCIA: DefinicionPrueba[] = [
  {
    id: 'nivel-financiamiento',
    nombre: 'Nivel × financiamiento',
    relacion: 'Nivel del programa × fuente de financiamiento',
    variableFilas: 'Nivel del programa',
    variableColumnas: 'Financiamiento',
    poblacion: 'titulados que cursaron un posgrado',
    construir: tablaNivelFinanciamiento
  },
  {
    id: 'area-institucion',
    nombre: 'Área × institución',
    relacion: 'Área de interés × institución preferida',
    variableFilas: 'Área de interés',
    variableColumnas: 'Institución preferida',
    poblacion: 'titulados interesados en un posgrado',
    construir: tablaAreaInstitucionPrueba
  },
  {
    id: 'edad-formacion',
    nombre: 'Edad × formación',
    relacion: 'Edad × formación complementaria realizada',
    variableFilas: 'Edad',
    variableColumnas: 'Cursó un posgrado',
    poblacion: 'encuesta a titulados',
    construir: tablaEdadFormacion
  },
  {
    id: 'sector-remuneracion',
    nombre: 'Sector × remuneración',
    relacion: 'Sector × remuneración mensual',
    variableFilas: 'Sector',
    variableColumnas: 'Remuneración',
    poblacion: 'titulados que trabajan e informaron su remuneración',
    construir: tablaSectorRemuneracion
  }
];

// ---------------------------------------------------------------------------
// HU4: valoración de la formación por los titulados (escala 1–4)
// ---------------------------------------------------------------------------

export const ITEMS_VALORACION_TITULADOS = [
  { campo: 'satisfaccion_global', texto: 'Satisfacción global con la formación recibida' },
  { campo: 'concordancia_formacion', texto: 'Concordancia entre la formación y los requerimientos laborales' },
  { campo: 'pertinencia_labores', texto: 'Labores actuales pertinentes a la formación recibida (solo quienes trabajan)' },
  { campo: 'opinion_posgrado_fcyt', texto: 'Existen posgrados afines en la Dirección de Posgrado FCyT' }
] as const;

export type CampoValoracion = (typeof ITEMS_VALORACION_TITULADOS)[number]['campo'];

export interface ValoracionItem {
  campo: CampoValoracion;
  texto: string;
  estadisticos: EstadisticosLikert | null;
}

export function analizarValoracionTitulados(titulados: Titulado[]): ValoracionItem[] {
  return ITEMS_VALORACION_TITULADOS.map(({ campo, texto }) => ({
    campo,
    texto,
    estadisticos: estadisticosLikert(titulados.map((t) => t[campo]))
  }));
}

/** Aspectos de la formación y asignaturas (selección múltiple, % sobre todos los titulados). */
export function analizarAspectosFormacion(titulados: Titulado[]) {
  const base = titulados.length;
  return {
    utiles: frecuenciasMultiples(titulados.map((t) => t.aspectos_utiles), base, ASPECTOS_UTILES),
    mejorar: frecuenciasMultiples(titulados.map((t) => t.aspectos_mejorar), base, ASPECTOS_MEJORAR),
    asignaturasVentaja: frecuenciasMultiples(titulados.map((t) => t.asignaturas_ventaja), base, ASIGNATURAS_VENTAJA),
    asignaturasNoUtiles: frecuenciasMultiples(titulados.map((t) => t.asignaturas_no_utiles), base, ASIGNATURAS_NO_UTILES)
  };
}

// ---------------------------------------------------------------------------
// Mercado laboral: titulados
// ---------------------------------------------------------------------------

export function analizarMercadoTitulados(titulados: Titulado[]) {
  const situaciones = frecuencias(titulados.map((t) => t.situacion_laboral), SITUACIONES_LABORALES);
  const ocupados = titulados.filter((t) => t.situacion_laboral !== 'No trabaja');
  const enOrganizacion = titulados.filter((t) => t.situacion_laboral === 'Trabaja en una organización');
  const tiempos = frecuencias(titulados.map((t) => t.tiempo_primer_empleo), TIEMPOS_PRIMER_EMPLEO);
  const rapidos = tiempos.filas
    .filter((f) => ['Ya trabajaba antes de titularse', 'Menos de 1 mes', 'Entre 1 - 4 meses'].includes(f.categoria))
    .reduce((s, f) => s + f.n, 0);
  const conRemuneracion = titulados.filter((t) => t.remuneracion !== undefined);
  const emprendedores = titulados.filter((t) => t.situacion_laboral === 'Emprendimiento propio');
  const noTrabajan = titulados.filter((t) => t.situacion_laboral === 'No trabaja');
  return {
    situaciones,
    ocupacion: proporcion(ocupados.length, titulados.length),
    sectorEnOrganizacion: frecuencias(enOrganizacion.map((t) => t.sector), SECTORES),
    departamentos: frecuencias(titulados.map((t) => t.departamento), DEPARTAMENTOS),
    rubros: frecuencias(titulados.map((t) => t.rubro), RUBROS_TITULADO),
    cargos: frecuencias(titulados.map((t) => t.cargo), CARGOS_TITULADO),
    tiempos,
    /** Consiguió empleo en 4 meses o menos (incluye a quienes ya trabajaban). */
    insercionRapida: proporcion(rapidos, tiempos.total),
    yaTrabajaba: proporcion(tiempos.filas[0]?.n ?? 0, tiempos.total),
    /** Remuneración dentro de cada sector (porcentajes por sector). */
    remuneracionPorSector: SECTORES.map((sector) => ({
      sector,
      tabla: frecuencias(
        conRemuneracion.filter((t) => t.sector === sector).map((t) => t.remuneracion),
        REMUNERACIONES
      )
    })),
    remuneracionAlta: proporcion(
      conRemuneracion.filter((t) => t.remuneracion !== undefined && REMUNERACIONES_ALTAS.includes(t.remuneracion)).length,
      conRemuneracion.length
    ),
    razonesNoTrabaja: frecuencias(noTrabajan.map((t) => t.razon_no_trabaja), RAZONES_NO_TRABAJA),
    emprendimiento: {
      total: emprendedores.length,
      origen: frecuencias(emprendedores.map((t) => t.origen_emprendimiento), ORIGENES_EMPRENDIMIENTO),
      financiamiento: frecuencias(emprendedores.map((t) => t.financiamiento_negocio), FINANCIAMIENTOS_NEGOCIO),
      satisfaccion: frecuencias(emprendedores.map((t) => t.satisfaccion_negocio), SATISFACCIONES_NEGOCIO),
      importancia: frecuencias(emprendedores.map((t) => t.importancia_formacion_negocio), IMPORTANCIAS_FORMACION)
    }
  };
}

// ---------------------------------------------------------------------------
// Mercado laboral: empleadores
// ---------------------------------------------------------------------------

export function analizarEmpleadores(empleadores: Empleador[]) {
  const posibilidad = frecuencias(empleadores.map((e) => e.posibilidad_contratacion), POSIBILIDADES_CONTRATACION);
  const noPrevista = posibilidad.filas.find((f) => f.categoria === 'No prevista actualmente')?.n ?? 0;
  return {
    tipos: frecuencias(empleadores.map((e) => e.tipo), TIPOS_ORGANIZACION),
    tamanos: frecuencias(empleadores.map((e) => e.tamano), TAMANOS_EMPRESA),
    rubros: frecuencias(empleadores.map((e) => e.rubro), RUBROS_EMPLEADOR),
    contrato5: proporcion(empleadores.filter((e) => e.contrato_5_anios === 'Sí').length, empleadores.filter((e) => e.contrato_5_anios).length),
    posibilidad,
    /** Alta probabilidad o según crecimiento / proyectos. */
    prevenContratar: proporcion(posibilidad.total - noPrevista, posibilidad.total),
    niveles: frecuencias(empleadores.map((e) => e.nivel_demandado), NIVELES_DEMANDADOS),
    medios: frecuencias(empleadores.map((e) => e.medio_convocatoria), MEDIOS_CONVOCATORIA),
    cargos: frecuenciasMultiples(empleadores.map((e) => e.cargos), empleadores.length, CARGOS_EMPLEADOR),
    tecnologias: clasificarRespuestas(empleadores.map((e) => e.tendencias), TEMAS_TECNOLOGIA),
    habilidades: clasificarRespuestas(empleadores.map((e) => e.habilidades), TEMAS_HABILIDADES)
  };
}

// ---------------------------------------------------------------------------
// Empleadores: índice de acuerdo (Ecuación 2) por afirmación y por dimensión
// ---------------------------------------------------------------------------

export const codigoItem = (numero: number) => `item_${String(numero).padStart(2, '0')}`;

export function indicePorItem(empleadores: Empleador[], codigo: string): IndiceAcuerdo {
  return indiceAcuerdo(empleadores.map((e) => e.items_likert[codigo]));
}

export interface IndiceDimension {
  dimension: string;
  afirmaciones: number[];
  porItem: Array<{ numero: number; codigo: string; resultado: IndiceAcuerdo }>;
  /** Promedio de los índices de las afirmaciones de la dimensión (método del informe). */
  indice: number | null;
}

export function indicesPorDimension(empleadores: Empleador[]): IndiceDimension[] {
  return DIMENSIONES_EMPLEADORES.map(({ dimension, afirmaciones }) => {
    const porItem = afirmaciones.map((numero) => {
      const codigo = codigoItem(numero);
      return { numero, codigo, resultado: indicePorItem(empleadores, codigo) };
    });
    const indices = porItem.map((p) => p.resultado.indice).filter((v): v is number => v !== null);
    return {
      dimension,
      afirmaciones,
      porItem,
      indice: indices.length > 0 ? indices.reduce((a, b) => a + b, 0) / indices.length : null
    };
  });
}
