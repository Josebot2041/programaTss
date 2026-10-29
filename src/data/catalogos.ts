/**
 * Catálogos de categorías válidas, tomados de la base real
 * Base_Limpia_Titulados_Empleadores.xlsx (hojas Titulados, Empleadores e Items_empleadores).
 *
 * Son la única fuente de verdad para tipos, formularios, importación y exportación.
 * El orden de cada arreglo es el orden lógico en que se muestran tablas y gráficos.
 */

// ---------------------------------------------------------------------------
// Comunes
// ---------------------------------------------------------------------------

export const SI_NO = ['Sí', 'No'] as const;

/** Escala Likert de 4 puntos de los titulados (se guarda como número 1–4). */
export const LIKERT_TITULADOS = [
  'Totalmente en desacuerdo',
  'En desacuerdo',
  'De acuerdo',
  'Totalmente de acuerdo'
] as const;

// ---------------------------------------------------------------------------
// Titulados
// ---------------------------------------------------------------------------

export const EDADES = ['19 - 22 años', '23 - 26 años', '27 - 30 años', '31 - 34 años', '35 años o más'] as const;

export const GENEROS = ['Hombre', 'Mujer'] as const;

export const NIVELES_POSGRADO = ['Diplomado', 'Especialidad', 'Maestría', 'Doctorado'] as const;

export const LUGARES_POSGRADO = [
  'Posgrado FCyT',
  'EUPG',
  'Univ. públicas nacionales',
  'Univ. privadas nacionales',
  'Univ. internacionales',
  'Otro'
] as const;

export const FINANCIAMIENTOS = ['Recursos propios', 'Beca parcial', 'Beca total'] as const;

export const AREAS_POSGRADO = [
  'IA',
  'Ingeniería de Software',
  'Redes de Datos y Seguridad',
  'Base de Datos',
  'Robótica'
] as const;

export const INSTITUCIONES_PREFERIDAS = [
  'Posgrado FCyT',
  'EUPG',
  'Univ. públicas nacionales',
  'Univ. privadas nacionales',
  'Univ. internacionales',
  'IBNORCA',
  'Otro'
] as const;

export const SITUACIONES_LABORALES = ['Trabaja en una organización', 'Emprendimiento propio', 'No trabaja'] as const;

export const RUBROS_TITULADO = [
  'Desarrollo de Software',
  'Telecomunicaciones',
  'Redes de Computadoras',
  'Banca',
  'Educación',
  'Salud',
  'Otro'
] as const;

export const SECTORES = ['Privado', 'Público'] as const;

export const DEPARTAMENTOS = [
  'Cochabamba',
  'La Paz',
  'Santa Cruz',
  'Oruro',
  'Potosí',
  'Chuquisaca',
  'Tarija',
  'Beni',
  'Pando',
  'Extranjero'
] as const;

export const ACTIVIDADES = ['Desarrollo', 'Cómputo', 'Administración', 'Contabilidad'] as const;

export const CARGOS_TITULADO = ['Desarrollo', 'Ejecutivo', 'Técnico', 'Help Desk', 'Otro'] as const;

export const ANTIGUEDADES = [
  'Menos de 1 año',
  'Entre 1 a 2 años',
  'Entre 2 a 5 años',
  'Entre 5 a 8 años',
  'Entre 8 a 11 años',
  'Entre 11 a 15 años',
  'Entre 15 a 20 años',
  'Entre 20 a 25 años',
  'Más de 25 años'
] as const;

export const MEDIOS_OBTENCION = [
  'Postulación competitiva (convocatorias públicas y privadas)',
  'Recomendación de terceros',
  'Internet y redes sociales',
  'Medios escritos o audiovisuales',
  'Otros'
] as const;

export const REMUNERACIONES = [
  'Menor a Bs. 2.500',
  'Entre Bs. 2.500 - Bs. 3.500',
  'Entre Bs. 3.501 - Bs. 5.000',
  'Entre Bs. 5.001 - Bs. 7.000',
  'Entre Bs. 7.001 - Bs. 10.000',
  'Más de Bs. 10.000'
] as const;

/** Tramos de remuneración que superan Bs. 7 000 (para el cruce sector × remuneración). */
export const REMUNERACIONES_ALTAS: readonly Remuneracion[] = ['Entre Bs. 7.001 - Bs. 10.000', 'Más de Bs. 10.000'];

export const ORIGENES_EMPRENDIMIENTO = ['Idea propia', 'Idea conjunta con compañeros', 'StartUp', 'Otro'] as const;

export const ENTREGABLES_NEGOCIO = ['Producto', 'Servicio', 'Ambos'] as const;

export const FINANCIAMIENTOS_NEGOCIO = [
  'No, financiamiento propio',
  'Sí, mediante préstamos bancarios',
  'Sí, mediante inversores'
] as const;

export const SATISFACCIONES_NEGOCIO = ['Satisfecho', 'Algo satisfecho', 'Insatisfecho'] as const;

export const IMPORTANCIAS_FORMACION = ['Muy importante', 'Importante', 'Poco importante'] as const;

export const RAZONES_NO_TRABAJA = [
  'Incumplimiento de requisitos en habilidades específicas (idiomas, softwares, etc)',
  'Demanda laboral inexistente',
  'Incumplimiento de requisitos de experiencia previa',
  'Ofertas laborales con remuneración muy bajas',
  'Red de contactos limitada',
  'Habilidades deficientes en las entrevistas',
  'Otro'
] as const;

export const TIEMPOS_PRIMER_EMPLEO = [
  'Ya trabajaba antes de titularse',
  'Menos de 1 mes',
  'Entre 1 - 4 meses',
  'Entre 4 - 8 meses',
  'Entre 8 - 12 meses',
  'Más de 12 meses'
] as const;

export const NUMERO_EMPLEOS = ['1', '2', '3', 'Más de 3'] as const;

export const ASPECTOS_UTILES = [
  'Habilidades analíticas y resolución de problemas',
  'Aplicación práctica en proyectos reales',
  'Trabajo en equipos multidisciplinarios',
  'Herramientas y software de la industria',
  'Pasantías o prácticas profesionales',
  'Distribución de horarios'
] as const;

export const ASPECTOS_MEJORAR = [
  'Actualización constante del plan',
  'Relación con empresas (prácticas)',
  'Integrar teoría con práctica',
  'Más opciones de especialización',
  'Actividades extracurriculares',
  'Horarios para trabajadores / virtual'
] as const;

export const ASIGNATURAS_VENTAJA = [
  'Base de Datos',
  'T.I.S.',
  'Redes de Computadora',
  'Planificación de Proyectos y Gestión',
  'Electivas',
  'Inteligencia Artificial',
  'Introducción',
  'Tecnología Redes Avanzadas',
  'Básicas (Física, Cálculo, Álgebra)'
] as const;

export const ASIGNATURAS_NO_UTILES = [
  'Aplic. Interactivas TV Digital',
  'Básicas (Física, Cálculo, Álgebra)',
  'Contabilidad Básica',
  'Telefonía IP',
  'Web Semánticas',
  'Robótica',
  'Taller de Programación en Bajo Nivel',
  'Teoría de Autómatas y Leng. Formales',
  'Graficación por Computadora',
  'Teoría de Grafos',
  'Programación Funcional'
] as const;

// ---------------------------------------------------------------------------
// Empleadores
// ---------------------------------------------------------------------------

export const TIPOS_ORGANIZACION = ['Privado', 'Público'] as const;

export const TAMANOS_EMPRESA = ['Micro', 'Pequeña', 'Mediana', 'Grande'] as const;

export const RUBROS_EMPLEADOR = [
  'Desarrollo de software',
  'Startups o emprendimientos tecnológicos',
  'Telecomunicaciones y redes',
  'Servicios de tecnologías de información (TI)',
  'Soporte técnico y mantenimiento de sistemas',
  'Instituciones públicas / gobierno',
  'Salud',
  'Industria y manufactura',
  'Educación e investigación',
  'Banca y servicios financieros',
  'Consultoría en sistemas / transformación digital',
  'Comercio y comercio electrónico',
  'Otros'
] as const;

export const POSIBILIDADES_CONTRATACION = [
  'Alta probabilidad',
  'Depende del crecimiento / proyectos',
  'No prevista actualmente'
] as const;

export const NIVELES_DEMANDADOS = ['Licenciatura', 'Diplomado', 'Especialidad', 'Maestría'] as const;

export const MEDIOS_CONVOCATORIA = [
  'Internet y redes sociales',
  'Postulación competitiva',
  'Recomendación de terceros',
  'Medios escritos y audiovisuales',
  'Oferta profesional personal',
  'Otros'
] as const;

export const CARGOS_EMPLEADOR = [
  'Técnico',
  'Analista',
  'Especialista',
  'Apoyo / asistencia tecnológica',
  'Supervisor / coordinador',
  'Jefatura o gerencial',
  'Consultor tecnológico'
] as const;

/** Escala de las 18 afirmaciones de empleadores. "No sabe" se excluye del índice (Ec. 2). */
export const LIKERT_EMPLEADOR = [
  'Totalmente de acuerdo',
  'Parcialmente de acuerdo',
  'Totalmente en desacuerdo',
  'No sabe'
] as const;

/** Códigos de las 18 afirmaciones (columnas item_01 … item_18). */
export const CODIGOS_ITEMS = Array.from({ length: 18 }, (_, i) => `item_${String(i + 1).padStart(2, '0')}`);

// ---------------------------------------------------------------------------
// Tipos derivados
// ---------------------------------------------------------------------------

export type SiNo = (typeof SI_NO)[number];
export type Likert = 1 | 2 | 3 | 4;
export type Edad = (typeof EDADES)[number];
export type Genero = (typeof GENEROS)[number];
export type NivelPosgrado = (typeof NIVELES_POSGRADO)[number];
export type LugarPosgrado = (typeof LUGARES_POSGRADO)[number];
export type Financiamiento = (typeof FINANCIAMIENTOS)[number];
export type AreaPosgrado = (typeof AREAS_POSGRADO)[number];
export type InstitucionPreferida = (typeof INSTITUCIONES_PREFERIDAS)[number];
export type SituacionLaboral = (typeof SITUACIONES_LABORALES)[number];
export type RubroTitulado = (typeof RUBROS_TITULADO)[number];
export type Sector = (typeof SECTORES)[number];
export type Departamento = (typeof DEPARTAMENTOS)[number];
export type Actividad = (typeof ACTIVIDADES)[number];
export type CargoTitulado = (typeof CARGOS_TITULADO)[number];
export type Antiguedad = (typeof ANTIGUEDADES)[number];
export type MedioObtencion = (typeof MEDIOS_OBTENCION)[number];
export type Remuneracion = (typeof REMUNERACIONES)[number];
export type OrigenEmprendimiento = (typeof ORIGENES_EMPRENDIMIENTO)[number];
export type EntregableNegocio = (typeof ENTREGABLES_NEGOCIO)[number];
export type FinanciamientoNegocio = (typeof FINANCIAMIENTOS_NEGOCIO)[number];
export type SatisfaccionNegocio = (typeof SATISFACCIONES_NEGOCIO)[number];
export type ImportanciaFormacion = (typeof IMPORTANCIAS_FORMACION)[number];
export type RazonNoTrabaja = (typeof RAZONES_NO_TRABAJA)[number];
export type TiempoPrimerEmpleo = (typeof TIEMPOS_PRIMER_EMPLEO)[number];
export type NumeroEmpleos = (typeof NUMERO_EMPLEOS)[number];
export type AspectoUtil = (typeof ASPECTOS_UTILES)[number];
export type AspectoMejorar = (typeof ASPECTOS_MEJORAR)[number];
export type AsignaturaVentaja = (typeof ASIGNATURAS_VENTAJA)[number];
export type AsignaturaNoUtil = (typeof ASIGNATURAS_NO_UTILES)[number];

export type TipoOrganizacion = (typeof TIPOS_ORGANIZACION)[number];
export type TamanoEmpresa = (typeof TAMANOS_EMPRESA)[number];
export type RubroEmpleador = (typeof RUBROS_EMPLEADOR)[number];
export type PosibilidadContratacion = (typeof POSIBILIDADES_CONTRATACION)[number];
export type NivelDemandado = (typeof NIVELES_DEMANDADOS)[number];
export type MedioConvocatoria = (typeof MEDIOS_CONVOCATORIA)[number];
export type CargoEmpleador = (typeof CARGOS_EMPLEADOR)[number];
export type LikertEmpleador = (typeof LIKERT_EMPLEADOR)[number];

// ---------------------------------------------------------------------------
// Segmentación profesional (HU1)
// ---------------------------------------------------------------------------

export const UMBRAL_JUNIOR_ANIOS = 5;

export const SEGMENTOS = ['Junior (< 5 años)', 'Consolidado (≥ 5 años)'] as const;
export type Segmento = (typeof SEGMENTOS)[number];

/** Clasifica según los años de vida profesional; sin dato no hay segmento. */
export function segmentoDe(anios: number | undefined): Segmento | undefined {
  if (anios === undefined) return undefined;
  return anios < UMBRAL_JUNIOR_ANIOS ? 'Junior (< 5 años)' : 'Consolidado (≥ 5 años)';
}

// ---------------------------------------------------------------------------
// Usuarios de la web
// ---------------------------------------------------------------------------

export const ROLES = ['usuario', 'admin'] as const;
export type Rol = (typeof ROLES)[number];

/** Extensiones departamentales del CI boliviano (opcionales: "1234567 LP"). */
export const EXTENSIONES_CI = ['LP', 'CB', 'SC', 'OR', 'PT', 'CH', 'TJ', 'BE', 'PD'] as const;
export type ExtensionCi = (typeof EXTENSIONES_CI)[number];
