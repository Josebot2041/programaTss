/**
 * Limpieza de los Excel crudos de los formularios oficiales (data/encuestas/) con las reglas de la
 * base limpia: años escritos como texto → número, desempleo mayor que la vida profesional → nulo,
 * respuestas de prueba descartadas, selección múltiple separada por ";" y etiquetas normalizadas a
 * los catálogos de src/data/catalogos.ts.
 *
 * Solo arma las filas de la base limpia (mismo formato de columnas que lee el importador) y anota
 * cada corrección o descarte; leer y escribir archivos queda en server/scripts/cargar-nuevas-encuestas.ts.
 * Los datos de contacto de los titulados (correo, teléfono, LinkedIn) no pasan a la base limpia.
 */

import {
  ACTIVIDADES,
  AREAS_POSGRADO,
  ASIGNATURAS_NO_UTILES,
  ASIGNATURAS_VENTAJA,
  ASPECTOS_MEJORAR,
  ASPECTOS_UTILES,
  CARGOS_EMPLEADOR,
  CARGOS_TITULADO,
  CODIGOS_ITEMS,
  DEPARTAMENTOS,
  EDADES,
  ENTREGABLES_NEGOCIO,
  FINANCIAMIENTOS,
  FINANCIAMIENTOS_NEGOCIO,
  GENEROS,
  IMPORTANCIAS_FORMACION,
  INSTITUCIONES_PREFERIDAS,
  LIKERT_EMPLEADOR,
  LIKERT_TITULADOS,
  LUGARES_POSGRADO,
  MEDIOS_CONVOCATORIA,
  MEDIOS_OBTENCION,
  NIVELES_DEMANDADOS,
  NIVELES_POSGRADO,
  NUMERO_EMPLEOS,
  ORIGENES_EMPRENDIMIENTO,
  POSIBILIDADES_CONTRATACION,
  RAZONES_NO_TRABAJA,
  REMUNERACIONES,
  RUBROS_EMPLEADOR,
  RUBROS_TITULADO,
  SATISFACCIONES_NEGOCIO,
  SECTORES,
  SI_NO,
  SITUACIONES_LABORALES,
  TAMANOS_EMPRESA,
  TIEMPOS_PRIMER_EMPLEO,
  TIPOS_ORGANIZACION,
  ANTIGUEDADES
} from '../src/data/catalogos';
import { COLUMNAS_EMPLEADORES, COLUMNAS_TITULADOS, normalizarTexto } from '../src/utils/importador';

export type Celda = string | number;

export interface Correccion {
  hoja: 'Titulados' | 'Empleadores';
  /** Id de la respuesta (titulados) o número de respuesta en el formulario (empleadores). */
  id: string;
  columna: string;
  antes: string;
  despues: string;
  motivo: string;
}

export interface Descarte {
  hoja: 'Titulados' | 'Empleadores';
  id: string;
  motivo: string;
}

export interface BaseLimpia {
  /** Filas con encabezado, en el orden de columnas del importador. */
  titulados: Celda[][];
  empleadores: Celda[][];
  items: Celda[][];
  correcciones: Correccion[];
  descartes: Descarte[];
}

/** Textos cortos de las 18 afirmaciones (mismos códigos y orden que el formulario de empleadores). */
export const AFIRMACIONES = [
  'La Carrera brinda confianza como formadora de profesionales del área tecnológica',
  'El título es consistente con el nivel de formación y las competencias demostradas',
  'Las autoridades de la Carrera consultan regularmente nuestra opinión',
  'Conozco el perfil profesional y las competencias de egreso',
  'El perfil profesional es coherente con el desempeño laboral de los titulados',
  'La formación permite un desempeño destacado profesional e integral',
  'La Carrera incorpora las necesidades del sector en prácticas, pasantías y titulación',
  'Los titulados evidencian competencias laborales (comunicación, análisis, equipo, TI)',
  'Los titulados demuestran valores: ética, responsabilidad social, inclusión, ambiente',
  'He participado en procesos de evaluación o retroalimentación sobre los titulados',
  'La Carrera mantiene vínculos que generan oportunidades laborales para los titulados',
  'He participado en actividades de vinculación con el entorno laboral y tecnológico',
  'He participado en difusión de oportunidades laborales, convocatorias o pasantías',
  'He participado en actividades de intercambio entre profesionales, empleadores, docentes y estudiantes',
  'He sido consultado sobre el desempeño de los titulados para retroalimentar el plan de estudios',
  'La Carrera ha consultado nuestra opinión sobre la pertinencia de la formación',
  'Recurrimos a la UMSS y a la Carrera como fuente de talento profesional',
  'He sido consultado periódicamente durante la autoevaluación y mejora continua'
];

// ---------------------------------------------------------------------------
// Diccionarios: etiqueta del formulario → etiqueta del catálogo
// ---------------------------------------------------------------------------

type Diccionario = Map<string, string>;

function diccionario(catalogo: readonly string[], alias: Record<string, string> = {}): Diccionario {
  const d: Diccionario = new Map();
  for (const v of catalogo) d.set(normalizarTexto(v), v);
  for (const [variante, canonico] of Object.entries(alias)) d.set(normalizarTexto(variante), canonico);
  return d;
}

const INSTITUCIONES_FORM = {
  'DIRECCIÓN DE POSGRADO FCyT': 'Posgrado FCyT',
  'ESCUELA UNIVERSITARIA DE POSGRADO (EUPG)': 'EUPG',
  'UNIVERSIDADES PÚBLICAS NACIONALES': 'Univ. públicas nacionales',
  'UNIVERSIDADES PRIVADAS NACIONALES': 'Univ. privadas nacionales',
  'UNIVERSIDADES INTERNACIONALES': 'Univ. internacionales'
};

const D = {
  siNo: diccionario(SI_NO, { si: 'Sí' }),
  edad: diccionario(EDADES),
  genero: diccionario(GENEROS),
  nivel: diccionario(NIVELES_POSGRADO),
  // IBNORCA no es opción del lugar donde se cursó; como en la base limpia, cuenta como "Otro"
  lugar: diccionario(LUGARES_POSGRADO, { ...INSTITUCIONES_FORM, IBNORCA: 'Otro' }),
  financiamiento: diccionario(FINANCIAMIENTOS, {
    'FINANCIADO CON RECURSOS PROPIOS': 'Recursos propios',
    'FINANCIADO PARCIALMENTE POR MEDIO DE UNA BECA': 'Beca parcial',
    'TOTAL FINANCIAMIENTO POR MEDIO DE UNA BECA': 'Beca total'
  }),
  area: diccionario(AREAS_POSGRADO),
  institucion: diccionario(INSTITUCIONES_PREFERIDAS, INSTITUCIONES_FORM),
  likert: diccionario(LIKERT_TITULADOS),
  situacion: diccionario(SITUACIONES_LABORALES, {
    'Actualmente dedico mi tiempo COMPLETO a un emprendimiento propio': 'Emprendimiento propio',
    'Actualmente me encuentro trabajando un una organización': 'Trabaja en una organización',
    'Actualmente NO trabajo': 'No trabaja'
  }),
  rubro: diccionario(RUBROS_TITULADO),
  sector: diccionario(SECTORES),
  departamento: diccionario(DEPARTAMENTOS),
  actividad: diccionario(ACTIVIDADES),
  cargo: diccionario(CARGOS_TITULADO),
  antiguedad: diccionario(ANTIGUEDADES),
  medio: diccionario(MEDIOS_OBTENCION),
  remuneracion: diccionario(REMUNERACIONES),
  origen: diccionario(ORIGENES_EMPRENDIMIENTO),
  entregable: diccionario(ENTREGABLES_NEGOCIO),
  financiamientoNegocio: diccionario(FINANCIAMIENTOS_NEGOCIO),
  satisfaccionNegocio: diccionario(SATISFACCIONES_NEGOCIO),
  importancia: diccionario(IMPORTANCIAS_FORMACION),
  razon: diccionario(RAZONES_NO_TRABAJA),
  tiempo: diccionario(TIEMPOS_PRIMER_EMPLEO),
  numeroEmpleos: diccionario(NUMERO_EMPLEOS),
  utiles: diccionario(ASPECTOS_UTILES, {
    'El desarrollo de habilidades analíticas y de resolución de problemas': 'Habilidades analíticas y resolución de problemas',
    'La aplicación práctica de conceptos teóricos en proyectos reales': 'Aplicación práctica en proyectos reales',
    'La colaboración de equipos multidisciplinarios para resolver problemas complejos': 'Trabajo en equipos multidisciplinarios',
    'La enseñanza de herramientas y software específico de la industria': 'Herramientas y software de la industria',
    'La oportunidad de realizar pasantías o prácticas profesionales': 'Pasantías o prácticas profesionales',
    'La distribución de los horarios de clases': 'Distribución de horarios'
  }),
  mejorar: diccionario(ASPECTOS_MEJORAR, {
    'Actualización constante del plan de estudios para atender tendencias actuales': 'Actualización constante del plan',
    'Mayor relacionamiento del estudiante con las empresas por medio de práctica profesionales': 'Relación con empresas (prácticas)',
    'Mayor integración de la teoría con aplicaciones prácticas en el plan de estudios': 'Integrar teoría con práctica',
    'Ofrecimiento de más opciones de especialización': 'Más opciones de especialización',
    'Incremento de actividades extracurriculares (Investigación, servicio social, etc)': 'Actividades extracurriculares',
    'La distribución de horarios de clases. (Horario para trabajadores, módulos virtuales, etc)': 'Horarios para trabajadores / virtual'
  }),
  ventaja: diccionario(ASIGNATURAS_VENTAJA, { 'Básicas (Física, Calculo, Algebras)': 'Básicas (Física, Cálculo, Álgebra)' }),
  noUtiles: diccionario(ASIGNATURAS_NO_UTILES, {
    'Básicas (Física, Calculo, Algebras)': 'Básicas (Física, Cálculo, Álgebra)',
    'Aplic. Interactivas para Televisión Digital': 'Aplic. Interactivas TV Digital'
  }),
  tipo: diccionario(TIPOS_ORGANIZACION),
  tamano: diccionario(TAMANOS_EMPRESA),
  rubroEmpleador: diccionario(RUBROS_EMPLEADOR),
  posibilidad: diccionario(POSIBILIDADES_CONTRATACION, {
    'Sí, existe una alta probabilidad de contratación': 'Alta probabilidad',
    'Sí, dependiendo del crecimiento o nuevos proyectos de la organización': 'Depende del crecimiento / proyectos',
    'No se tiene prevista la contratación actualmente': 'No prevista actualmente'
  }),
  nivelDemandado: diccionario(NIVELES_DEMANDADOS),
  medioConvocatoria: diccionario(MEDIOS_CONVOCATORIA, {
    'Postulación competitiva (convocatorias públicas y privadas)': 'Postulación competitiva'
  }),
  cargoEmpleador: diccionario(CARGOS_EMPLEADOR, {
    'De apoyo / asistencia tecnológica': 'Apoyo / asistencia tecnológica',
    'Supervisor / Coordinador de área tecnológica': 'Supervisor / coordinador'
  }),
  likertEmpleador: diccionario(LIKERT_EMPLEADOR, { 'Totalmente desacuerdo': 'Totalmente en desacuerdo' })
};

// ---------------------------------------------------------------------------
// Reglas
// ---------------------------------------------------------------------------

const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim());

const NUMEROS_ESCRITOS: Record<string, number> = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
const SIN_TIEMPO = new Set(['ninguno', 'ninguna', 'nada', 'ningun', 'ninguno siempre estuve con trabajo']);

/**
 * Años escritos como texto → número de años: "2 años" → 2, "1,5" → 1.5, "6 meses" → 0.5,
 * "Dos años" → 2, "Medio año" → 0.5, "Ninguno" → 0, "Más de 10 años" → 10 (el mínimo declarado).
 * Devuelve undefined si no se puede interpretar (n/a, texto sin sentido).
 */
export function aniosDeTexto(crudo: string): number | undefined {
  const n = normalizarTexto(crudo.replace(/(\d),(\d)/g, '$1.$2').replace(/(\d)\.(\d)/g, '$1p$2'));
  if (n === '') return undefined;
  if (SIN_TIEMPO.has(n) || n.startsWith('ninguno')) return 0;
  if (/^medio ano/.test(n)) return 0.5;
  const m = n.match(/(\d+(?:p\d+)?|\b(?:un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b)\s*(mes|meses|ano|anos|anio|anios)?\b/);
  if (!m) return undefined;
  const cantidad = /\d/.test(m[1]) ? Number(m[1].replace('p', '.')) : NUMEROS_ESCRITOS[m[1]];
  const enMeses = m[2]?.startsWith('mes');
  return Math.round((enMeses ? cantidad / 12 : cantidad) * 100) / 100;
}

/** Respuesta de prueba: texto sin contenido (menos de 2 letras distintas, p. ej. "lll" o "G"). */
export function esTextoDePrueba(valor: string): boolean {
  const letras = normalizarTexto(valor).replace(/[^a-z]/g, '');
  return new Set(letras).size < 2;
}

/** Contexto de una fila: anota correcciones con su id. */
class Fila {
  constructor(
    private readonly hoja: Correccion['hoja'],
    readonly id: string,
    private readonly correcciones: Correccion[]
  ) {}

  corregir(columna: string, antes: string, despues: string, motivo: string) {
    this.correcciones.push({ hoja: this.hoja, id: this.id, columna, antes, despues, motivo });
  }

  /** Etiqueta del catálogo; si no corresponde a ninguna, se deja sin respuesta y se anota. */
  categoria(columna: string, crudo: unknown, dic: Diccionario): string {
    const v = texto(crudo);
    if (!v) return '';
    const canonico = dic.get(normalizarTexto(v));
    if (canonico === undefined) {
      this.corregir(columna, v, '', 'Categoría fuera del catálogo; se deja sin respuesta');
      return '';
    }
    return canonico;
  }

  /** Selección múltiple: elementos del catálogo, sin repetir y en su orden, separados por "; ". */
  lista(columna: string, partes: string[], dic: Diccionario): string {
    const elegidos = new Set<string>();
    for (const parte of partes.map(texto).filter(Boolean)) {
      const canonico = dic.get(normalizarTexto(parte));
      if (canonico === undefined) this.corregir(columna, parte, '', 'Opción fuera del catálogo; se omite');
      else elegidos.add(canonico);
    }
    const orden = [...new Set(dic.values())];
    return [...elegidos].sort((a, b) => orden.indexOf(a) - orden.indexOf(b)).join('; ');
  }

  anios(columna: string, crudo: unknown): number | '' {
    const v = texto(crudo);
    if (!v) return '';
    const anios = aniosDeTexto(v);
    if (anios === undefined) {
      this.corregir(columna, v, '', 'No es una cantidad de tiempo; se deja sin respuesta');
      return '';
    }
    if (String(anios) !== v) this.corregir(columna, v, String(anios), 'Tiempo escrito como texto; se convierte a años');
    return anios;
  }
}

// ---------------------------------------------------------------------------
// Titulados (Microsoft Forms)
// ---------------------------------------------------------------------------

/** Columna del Excel de titulados por campo de la base limpia. */
const COL_T = {
  id: 0,
  edad: 8,
  genero: 11,
  formacion_complementaria: 14,
  nivel_realizado: 17,
  lugar_realizado: 20,
  financiamiento: 23,
  programa: 26,
  interes_posgrado: 29,
  area_interes: 32,
  institucion_preferida: 35,
  opinion_posgrado_fcyt: 40,
  anios_vida_profesional: 43,
  anios_desempleado: 46,
  situacion_laboral: 49,
  empresa: 52,
  rubro: 55,
  rubro_otro: 58,
  sector: 61,
  departamento: 64,
  actividades: 67,
  cargo: 73,
  cargo_otro: 76,
  pertinencia_labores: 81,
  antiguedad_trabajo: 84,
  medio_obtencion: 87,
  remuneracion: 90,
  origen_emprendimiento: 93,
  entregable_negocio: 96,
  financiamiento_negocio: 99,
  satisfaccion_negocio: 104,
  importancia_formacion_negocio: 109,
  primer_empleo: 112,
  razon_no_trabaja: 115,
  trabajo_previo_sistemas: 118,
  tiempo_primer_empleo: 121,
  numero_empleos: 124,
  satisfaccion_global: 129,
  concordancia_formacion: 134,
  aspectos_utiles: 137,
  aspectos_mejorar: 140,
  asignaturas_ventaja: 143,
  asignaturas_no_utiles: 149,
  red_contactos: 155
} as const;

/** Encabezados esperados en el Excel de titulados, para detectar si el formulario cambió. */
const ENCABEZADOS_T: Array<[number, string]> = [
  [COL_T.id, 'id'],
  [COL_T.edad, 'edad que tiene actualmente'],
  [COL_T.situacion_laboral, 'situacion laboral actual'],
  [COL_T.anios_vida_profesional, 'anos de vida profesional'],
  [COL_T.red_contactos, 'red de contactos']
];

const OBLIGATORIOS_T = ['edad', 'genero', 'formacion_complementaria', 'situacion_laboral'] as const;

function actividadesDe(crudo: unknown): string[] {
  const v = texto(crudo);
  if (!v) return [];
  if (v.startsWith('[')) {
    try {
      return JSON.parse(v) as string[];
    } catch {
      return [v];
    }
  }
  return v.split(';');
}

function limpiarTitulado(r: unknown[], correcciones: Correccion[]): { celdas?: Record<string, Celda>; descarte?: string; id: string } {
  const id = texto(r[COL_T.id]);
  const f = new Fila('Titulados', id, correcciones);
  const c = (campo: keyof typeof COL_T) => r[COL_T[campo]];

  const t: Record<string, Celda> = {
    id,
    edad: f.categoria('edad', c('edad'), D.edad),
    genero: f.categoria('genero', c('genero'), D.genero),
    formacion_complementaria: f.categoria('formacion_complementaria', c('formacion_complementaria'), D.siNo),
    nivel_realizado: f.categoria('nivel_realizado', c('nivel_realizado'), D.nivel),
    lugar_realizado: f.categoria('lugar_realizado', c('lugar_realizado'), D.lugar),
    financiamiento: f.categoria('financiamiento', c('financiamiento'), D.financiamiento),
    programa: texto(c('programa')),
    interes_posgrado: f.categoria('interes_posgrado', c('interes_posgrado'), D.siNo),
    area_interes: f.categoria('area_interes', c('area_interes'), D.area),
    institucion_preferida: f.categoria('institucion_preferida', c('institucion_preferida'), D.institucion),
    opinion_posgrado_fcyt: f.categoria('opinion_posgrado_fcyt', c('opinion_posgrado_fcyt'), D.likert),
    anios_vida_profesional: f.anios('anios_vida_profesional', c('anios_vida_profesional')),
    anios_desempleado: f.anios('anios_desempleado', c('anios_desempleado')),
    situacion_laboral: f.categoria('situacion_laboral', c('situacion_laboral'), D.situacion),
    empresa: texto(c('empresa')),
    rubro: f.categoria('rubro', c('rubro'), D.rubro),
    sector: f.categoria('sector', c('sector'), D.sector),
    departamento: f.categoria('departamento', c('departamento'), D.departamento),
    actividades: f.lista('actividades', actividadesDe(c('actividades')), D.actividad),
    cargo: f.categoria('cargo', c('cargo'), D.cargo),
    pertinencia_labores: f.categoria('pertinencia_labores', c('pertinencia_labores'), D.likert),
    antiguedad_trabajo: f.categoria('antiguedad_trabajo', c('antiguedad_trabajo'), D.antiguedad),
    medio_obtencion: f.categoria('medio_obtencion', c('medio_obtencion'), D.medio),
    remuneracion: f.categoria('remuneracion', c('remuneracion'), D.remuneracion),
    origen_emprendimiento: f.categoria('origen_emprendimiento', c('origen_emprendimiento'), D.origen),
    entregable_negocio: f.categoria('entregable_negocio', c('entregable_negocio'), D.entregable),
    financiamiento_negocio: f.categoria('financiamiento_negocio', c('financiamiento_negocio'), D.financiamientoNegocio),
    satisfaccion_negocio: f.categoria('satisfaccion_negocio', c('satisfaccion_negocio'), D.satisfaccionNegocio),
    importancia_formacion_negocio: f.categoria('importancia_formacion_negocio', c('importancia_formacion_negocio'), D.importancia),
    primer_empleo: f.categoria('primer_empleo', c('primer_empleo'), D.siNo),
    razon_no_trabaja: f.categoria('razon_no_trabaja', c('razon_no_trabaja'), D.razon),
    trabajo_previo_sistemas: f.categoria('trabajo_previo_sistemas', c('trabajo_previo_sistemas'), D.siNo),
    tiempo_primer_empleo: f.categoria('tiempo_primer_empleo', c('tiempo_primer_empleo'), D.tiempo),
    numero_empleos: f.categoria('numero_empleos', c('numero_empleos'), D.numeroEmpleos),
    satisfaccion_global: f.categoria('satisfaccion_global', c('satisfaccion_global'), D.likert),
    concordancia_formacion: f.categoria('concordancia_formacion', c('concordancia_formacion'), D.likert),
    aspectos_utiles: f.lista('aspectos_utiles', texto(c('aspectos_utiles')).split(';'), D.utiles),
    aspectos_mejorar: f.lista('aspectos_mejorar', texto(c('aspectos_mejorar')).split(';'), D.mejorar),
    asignaturas_ventaja: f.lista('asignaturas_ventaja', texto(c('asignaturas_ventaja')).split(';'), D.ventaja),
    asignaturas_no_utiles: f.lista('asignaturas_no_utiles', texto(c('asignaturas_no_utiles')).split(';'), D.noUtiles),
    red_contactos: f.categoria('red_contactos', c('red_contactos'), D.siNo)
  };

  // Un rubro o cargo escrito en "Otro" cuenta como la opción "Otro" del catálogo
  for (const [campo, otro] of [['rubro', 'rubro_otro'], ['cargo', 'cargo_otro']] as const) {
    const libre = texto(c(otro));
    if (t[campo] === '' && libre && !esTextoDePrueba(libre)) {
      t[campo] = 'Otro';
      f.corregir(campo, libre, 'Otro', 'Respuesta escrita en «Otro»; se clasifica como Otro');
    }
  }

  const faltan = OBLIGATORIOS_T.filter((campo) => t[campo] === '');
  if (faltan.length > 0) return { id, descarte: `Faltan campos obligatorios: ${faltan.join(', ')}` };

  // Regla de la base limpia: el desempleo no puede superar la vida profesional
  const vida = t.anios_vida_profesional;
  const desempleo = t.anios_desempleado;
  if (typeof vida === 'number' && typeof desempleo === 'number' && desempleo > vida) {
    f.corregir('anios_desempleado', String(desempleo), '', `Supera los años de vida profesional (${vida}); se deja sin respuesta`);
    t.anios_desempleado = '';
  }
  return { id, celdas: t };
}

// ---------------------------------------------------------------------------
// Empleadores (Google Forms)
// ---------------------------------------------------------------------------

const COL_E = {
  organizacion: 2,
  tipo: 3,
  tamano: 4,
  rubro: 5,
  contrato: 6,
  posibilidad: 7,
  nivel: 8,
  medio: 9,
  cargos: 10,
  tendencias: 11,
  herramientas: 12,
  habilidades: 13,
  primerItem: 14
};

const ENCABEZADOS_E: Array<[number, string]> = [
  [COL_E.organizacion, 'nombre de la empresa'],
  [COL_E.tipo, 'tipo de organizacion'],
  [COL_E.cargos, 'tipo de cargos'],
  [COL_E.primerItem, 'brinda confianza'],
  [COL_E.primerItem + 17, 'autoevaluacion']
];

function limpiarEmpleador(r: unknown[], numero: number, correcciones: Correccion[]): { celdas?: Record<string, Celda>; descarte?: string } {
  const f = new Fila('Empleadores', String(numero), correcciones);
  const organizacion = texto(r[COL_E.organizacion]);
  if (!organizacion || esTextoDePrueba(organizacion)) return { descarte: `Respuesta de prueba (organización «${organizacion}»)` };

  // "Grande (100 funcionarios o más)" → "Grande"
  const tamanoCrudo = texto(r[COL_E.tamano]);
  const tamano = f.categoria('tamano', tamanoCrudo.replace(/\s*\(.*\)$/, ''), D.tamano);

  // Rubros que no están en el catálogo (p. ej. "Seguridad informática / ciberseguridad") van a "Otros"
  const rubroCrudo = texto(r[COL_E.rubro]);
  let rubro = rubroCrudo ? (D.rubroEmpleador.get(normalizarTexto(rubroCrudo)) ?? '') : '';
  if (rubroCrudo && !rubro) {
    rubro = 'Otros';
    f.corregir('rubro', rubroCrudo, 'Otros', 'Rubro fuera del catálogo; se clasifica como Otros');
  }

  // Cargos: las descripciones entre paréntesis también llevan comas, así que se quitan antes de separar
  const cargos = f.lista('cargos', texto(r[COL_E.cargos]).replace(/\([^)]*\)/g, '').split(','), D.cargoEmpleador);

  const e: Record<string, Celda> = {
    id: '',
    organizacion,
    tipo: f.categoria('tipo', r[COL_E.tipo], D.tipo),
    tamano,
    rubro,
    contrato_5_anios: f.categoria('contrato_5_anios', r[COL_E.contrato], D.siNo),
    posibilidad_contratacion: f.categoria('posibilidad_contratacion', r[COL_E.posibilidad], D.posibilidad),
    nivel_demandado: f.categoria('nivel_demandado', r[COL_E.nivel], D.nivelDemandado),
    medio_convocatoria: f.categoria('medio_convocatoria', r[COL_E.medio], D.medioConvocatoria),
    cargos,
    // Como en la base limpia, "tendencias" reúne las preguntas 10 (áreas y tendencias) y 11
    // (herramientas): de ahí sale el análisis de tecnologías demandadas
    tendencias: [texto(r[COL_E.tendencias]), texto(r[COL_E.herramientas])].filter(Boolean).join(' '),
    habilidades: texto(r[COL_E.habilidades])
  };
  CODIGOS_ITEMS.forEach((codigo, i) => {
    e[codigo] = f.categoria(codigo, r[COL_E.primerItem + i], D.likertEmpleador);
  });

  const faltan = (['tipo', 'tamano'] as const).filter((campo) => e[campo] === '');
  if (faltan.length > 0) return { descarte: `Faltan campos obligatorios: ${faltan.join(', ')}` };
  return { celdas: e };
}

// ---------------------------------------------------------------------------
// Base completa
// ---------------------------------------------------------------------------

function comprobarEncabezados(hoja: string, encabezado: unknown[], esperados: Array<[number, string]>) {
  for (const [col, fragmento] of esperados) {
    if (!normalizarTexto(texto(encabezado[col])).includes(fragmento)) {
      throw new Error(`${hoja}: la columna ${col + 1} debería ser «${fragmento}» y es «${texto(encabezado[col])}». ¿Cambió el formulario?`);
    }
  }
}

/**
 * Limpia las filas crudas (con encabezado) de los dos formularios.
 *
 * Ids: los titulados conservan el Id de Microsoft Forms. Los empleadores de la base anterior
 * conservan su id (eran las primeras respuestas sin las de prueba, numeradas en orden); las
 * respuestas nuevas usan su número de respuesta en el formulario, así que nunca toman un id que
 * ya tenía otro empleador.
 */
export function limpiarEncuestas(filasTitulados: unknown[][], filasEmpleadores: unknown[][], empleadoresAnteriores: number): BaseLimpia {
  comprobarEncabezados('Titulados', filasTitulados[0] ?? [], ENCABEZADOS_T);
  comprobarEncabezados('Empleadores', filasEmpleadores[0] ?? [], ENCABEZADOS_E);

  const correcciones: Correccion[] = [];
  const descartes: Descarte[] = [];

  const titulados: Celda[][] = [COLUMNAS_TITULADOS.map((c) => c.nombre)];
  for (const r of filasTitulados.slice(1)) {
    if (r.every((v) => texto(v) === '')) continue;
    const { celdas, descarte, id } = limpiarTitulado(r, correcciones);
    if (descarte) descartes.push({ hoja: 'Titulados', id, motivo: descarte });
    else if (celdas) titulados.push(COLUMNAS_TITULADOS.map((c) => celdas[c.nombre] ?? ''));
  }

  const empleadores: Celda[][] = [COLUMNAS_EMPLEADORES.map((c) => c.nombre)];
  let conservados = 0;
  filasEmpleadores.slice(1).forEach((r, i) => {
    if (r.every((v) => texto(v) === '')) return;
    const numero = i + 1;
    const { celdas, descarte } = limpiarEmpleador(r, numero, correcciones);
    if (descarte || !celdas) {
      descartes.push({ hoja: 'Empleadores', id: String(numero), motivo: descarte ?? 'Sin datos' });
      return;
    }
    conservados++;
    celdas.id = String(conservados <= empleadoresAnteriores ? conservados : numero);
    empleadores.push(COLUMNAS_EMPLEADORES.map((c) => celdas[c.nombre] ?? ''));
  });

  const items: Celda[][] = [['codigo', 'afirmacion'], ...CODIGOS_ITEMS.map((codigo, i) => [codigo, AFIRMACIONES[i]])];
  return { titulados, empleadores, items, correcciones, descartes };
}
