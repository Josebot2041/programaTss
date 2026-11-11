/**
 * Script de migración: lee los Excel de Google/MS Forms y los carga en PostgreSQL.
 * Uso: npx tsx server/scripts/cargar-nuevas-encuestas.ts
 *
 * Reemplaza TODOS los registros de origen 'formulario' con los datos actualizados.
 */

import 'dotenv/config';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { pool, enTransaccion } from '../db.js';
import {
  insertarTitulado,
  insertarEmpleador,
  leerIds,
  type DatosInsercion
} from '../repositorio.js';

// ── Rutas de los Excel subidos ────────────────────────────────────────────────
const RUTA_TITULADOS   = 'C:/Users/ASUS/.gemini/antigravity/brain/f05a7f8c-a085-464c-92a6-fc4e99fafb74/.user_uploaded/media_1794406695075_5235ad63.xlsx';
const RUTA_EMPLEADORES = 'C:/Users/ASUS/.gemini/antigravity/brain/f05a7f8c-a085-464c-92a6-fc4e99fafb74/.user_uploaded/media_1794406695070_b449efde.xlsx';

// ── Normalización ─────────────────────────────────────────────────────────────
function norm(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\./g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function str(v: unknown): string {
  return (v === null || v === undefined) ? '' : String(v).trim();
}

function matchCatalogo<T extends string>(raw: unknown, opciones: readonly T[]): T | undefined {
  const n = norm(raw);
  if (!n) return undefined;
  for (const op of opciones) if (norm(op) === n) return op;
  for (const op of opciones) if (n.includes(norm(op)) || norm(op).includes(n)) return op;
  return undefined;
}

function parseSiNo(raw: unknown): 'Sí' | 'No' | undefined {
  const n = norm(raw);
  if (n === 'si' || n === 's' || n === 'yes') return 'Sí';
  if (n === 'no') return 'No';
  return undefined;
}

function parseAnios(raw: unknown): number | undefined {
  const n = Number(str(raw).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 60 ? n : undefined;
}

function likertTitulado(raw: unknown): 1 | 2 | 3 | 4 | undefined {
  const LIKERT = ['Totalmente en desacuerdo', 'En desacuerdo', 'De acuerdo', 'Totalmente de acuerdo'];
  const n = norm(raw);
  if (!n) return undefined;
  for (let i = 0; i < LIKERT.length; i++) {
    if (norm(LIKERT[i]) === n) return (i + 1) as 1 | 2 | 3 | 4;
  }
  for (let i = 0; i < LIKERT.length; i++) {
    if (n.includes(norm(LIKERT[i])) || norm(LIKERT[i]).includes(n)) return (i + 1) as 1 | 2 | 3 | 4;
  }
  return undefined;
}

function likertEmpleador(raw: unknown): string | undefined {
  // Valores exactos del form: "Totalmente de acuerdo", "Parcialmente de acuerdo",
  //                           "Totalmente desacuerdo", "No sabe"
  const LIKERT_EMP = ['Totalmente de acuerdo', 'Parcialmente de acuerdo', 'Totalmente en desacuerdo', 'No sabe'] as const;
  const n = norm(raw);
  if (!n) return undefined;
  // Mapeo exacto incluyendo "Totalmente desacuerdo" (sin "en")
  if (n === 'totalmente de acuerdo' || n === 'totalmente acuerdo') return 'Totalmente de acuerdo';
  if (n === 'parcialmente de acuerdo' || n === 'parcialmente acuerdo') return 'Parcialmente de acuerdo';
  if (n === 'totalmente desacuerdo' || n === 'totalmente en desacuerdo') return 'Totalmente en desacuerdo';
  if (n === 'no sabe' || n === 'ns' || n === 'no sabe no opina') return 'No sabe';
  return matchCatalogo(raw, LIKERT_EMP);
}

function parseLista<T extends string>(raw: unknown, opciones: readonly T[]): T[] {
  if (!raw || str(raw) === '') return [];
  let items: string[];
  const s = str(raw);
  if (s.startsWith('[')) {
    try { items = JSON.parse(s); } catch { items = [s]; }
  } else {
    items = s.split(/[;,]/).map(x => x.trim()).filter(x => x.length > 0);
  }
  const resultado: T[] = [];
  for (const item of items) {
    const m = matchCatalogo(item, opciones);
    if (m && !resultado.includes(m)) resultado.push(m);
  }
  return resultado;
}

// ── Catálogos ─────────────────────────────────────────────────────────────────
const EDADES = ['19 - 22 años', '23 - 26 años', '27 - 30 años', '31 - 34 años', '35 años o más'] as const;
const GENEROS = ['Hombre', 'Mujer'] as const;
const NIVELES_POSGRADO = ['Diplomado', 'Especialidad', 'Maestría', 'Doctorado'] as const;
const LUGARES_POSGRADO = ['Posgrado FCyT', 'EUPG', 'Univ. públicas nacionales', 'Univ. privadas nacionales', 'Univ. internacionales', 'Otro'] as const;
const FINANCIAMIENTOS = ['Recursos propios', 'Beca parcial', 'Beca total'] as const;
const AREAS_POSGRADO = ['IA', 'Ingeniería de Software', 'Redes de Datos y Seguridad', 'Base de Datos', 'Robótica'] as const;
const INSTITUCIONES_PREFERIDAS = ['Posgrado FCyT', 'EUPG', 'Univ. públicas nacionales', 'Univ. privadas nacionales', 'Univ. internacionales', 'IBNORCA', 'Otro'] as const;
const SITUACIONES_LABORALES = ['Trabaja en una organización', 'Emprendimiento propio', 'No trabaja'] as const;
const RUBROS_TITULADO = ['Desarrollo de Software', 'Telecomunicaciones', 'Redes de Computadoras', 'Banca', 'Educación', 'Salud', 'Otro'] as const;
const SECTORES = ['Privado', 'Público'] as const;
const DEPARTAMENTOS = ['Cochabamba', 'La Paz', 'Santa Cruz', 'Oruro', 'Potosí', 'Chuquisaca', 'Tarija', 'Beni', 'Pando', 'Extranjero'] as const;
const ACTIVIDADES = ['Desarrollo', 'Cómputo', 'Administración', 'Contabilidad'] as const;
const CARGOS_TITULADO = ['Desarrollo', 'Ejecutivo', 'Técnico', 'Help Desk', 'Otro'] as const;
const ANTIGUEDADES = ['Menos de 1 año', 'Entre 1 a 2 años', 'Entre 2 a 5 años', 'Entre 5 a 8 años', 'Entre 8 a 11 años', 'Entre 11 a 15 años', 'Entre 15 a 20 años', 'Entre 20 a 25 años', 'Más de 25 años'] as const;
const MEDIOS_OBTENCION = ['Postulación competitiva (convocatorias públicas y privadas)', 'Recomendación de terceros', 'Internet y redes sociales', 'Medios escritos o audiovisuales', 'Otros'] as const;
const REMUNERACIONES = ['Menor a Bs. 2.500', 'Entre Bs. 2.500 - Bs. 3.500', 'Entre Bs. 3.501 - Bs. 5.000', 'Entre Bs. 5.001 - Bs. 7.000', 'Entre Bs. 7.001 - Bs. 10.000', 'Más de Bs. 10.000'] as const;
const ORIGENES_EMPRENDIMIENTO = ['Idea propia', 'Idea conjunta con compañeros', 'StartUp', 'Otro'] as const;
const ENTREGABLES_NEGOCIO = ['Producto', 'Servicio', 'Ambos'] as const;
const FINANCIAMIENTOS_NEGOCIO = ['No, financiamiento propio', 'Sí, mediante préstamos bancarios', 'Sí, mediante inversores'] as const;
const SATISFACCIONES_NEGOCIO = ['Satisfecho', 'Algo satisfecho', 'Insatisfecho'] as const;
const IMPORTANCIAS_FORMACION = ['Muy importante', 'Importante', 'Poco importante'] as const;
const RAZONES_NO_TRABAJA = ['Incumplimiento de requisitos en habilidades específicas (idiomas, softwares, etc)', 'Demanda laboral inexistente', 'Incumplimiento de requisitos de experiencia previa', 'Ofertas laborales con remuneración muy bajas', 'Red de contactos limitada', 'Habilidades deficientes en las entrevistas', 'Otro'] as const;
const TIEMPOS_PRIMER_EMPLEO = ['Ya trabajaba antes de titularse', 'Menos de 1 mes', 'Entre 1 - 4 meses', 'Entre 4 - 8 meses', 'Entre 8 - 12 meses', 'Más de 12 meses'] as const;
const NUMERO_EMPLEOS = ['1', '2', '3', 'Más de 3'] as const;
const ASPECTOS_UTILES = ['Habilidades analíticas y resolución de problemas', 'Aplicación práctica en proyectos reales', 'Trabajo en equipos multidisciplinarios', 'Herramientas y software de la industria', 'Pasantías o prácticas profesionales', 'Distribución de horarios'] as const;
const ASPECTOS_MEJORAR = ['Actualización constante del plan', 'Relación con empresas (prácticas)', 'Integrar teoría con práctica', 'Más opciones de especialización', 'Actividades extracurriculares', 'Horarios para trabajadores / virtual'] as const;
const ASIGNATURAS_VENTAJA = ['Base de Datos', 'T.I.S.', 'Redes de Computadora', 'Planificación de Proyectos y Gestión', 'Electivas', 'Inteligencia Artificial', 'Introducción', 'Tecnología Redes Avanzadas', 'Básicas (Física, Cálculo, Álgebra)'] as const;
const ASIGNATURAS_NO_UTILES = ['Aplic. Interactivas TV Digital', 'Básicas (Física, Cálculo, Álgebra)', 'Contabilidad Básica', 'Telefonía IP', 'Web Semánticas', 'Robótica', 'Taller de Programación en Bajo Nivel', 'Teoría de Autómatas y Leng. Formales', 'Graficación por Computadora', 'Teoría de Grafos', 'Programación Funcional'] as const;

const TIPOS_ORGANIZACION = ['Privado', 'Público'] as const;
const TAMANOS_EMPRESA = ['Micro', 'Pequeña', 'Mediana', 'Grande'] as const;
const RUBROS_EMPLEADOR = ['Desarrollo de software', 'Startups o emprendimientos tecnológicos', 'Telecomunicaciones y redes', 'Servicios de tecnologías de información (TI)', 'Soporte técnico y mantenimiento de sistemas', 'Instituciones públicas / gobierno', 'Salud', 'Industria y manufactura', 'Educación e investigación', 'Banca y servicios financieros', 'Consultoría en sistemas / transformación digital', 'Comercio y comercio electrónico', 'Otros'] as const;
const POSIBILIDADES_CONTRATACION = ['Alta probabilidad', 'Depende del crecimiento / proyectos', 'No prevista actualmente'] as const;
const NIVELES_DEMANDADOS = ['Licenciatura', 'Diplomado', 'Especialidad', 'Maestría'] as const;
const MEDIOS_CONVOCATORIA = ['Internet y redes sociales', 'Postulación competitiva', 'Recomendación de terceros', 'Medios escritos y audiovisuales', 'Oferta profesional personal', 'Otros'] as const;
const CARGOS_EMPLEADOR = ['Técnico', 'Analista', 'Especialista', 'Apoyo / asistencia tecnológica', 'Supervisor / coordinador', 'Jefatura o gerencial', 'Consultor tecnológico'] as const;

// ── Converter: Titulados ──────────────────────────────────────────────────────
type Row = unknown[];

function parseSituacion(raw: unknown): string | undefined {
  const n = norm(raw);
  // Valores exactos del formulario de MS Forms:
  // "Actualmente dedico mi tiempo COMPLETO a un emprendimiento propio"
  // "Actualmente me encuentro trabajando un una organización"
  // "Actualmente NO trabajo"
  if (n.includes('emprendimiento') || n.includes('negocio propio')) return 'Emprendimiento propio';
  if (n.includes('organizacion') || n.includes('organización') || n.includes('trabajando')) return 'Trabaja en una organización';
  if (n.includes('no trabajo') || n.includes('no trabaja') || n.includes('sin empleo') || n.includes('desempleado')) return 'No trabaja';
  return matchCatalogo(raw, SITUACIONES_LABORALES);
}

function parseNivel(raw: unknown): string | undefined {
  const n = norm(raw);
  if (n.includes('diplomado')) return 'Diplomado';
  if (n.includes('maestria') || n.includes('maestría') || n.includes('magister')) return 'Maestría';
  if (n.includes('especialidad') || n.includes('especializacion')) return 'Especialidad';
  if (n.includes('doctorado') || n.includes('phd')) return 'Doctorado';
  return matchCatalogo(raw, NIVELES_POSGRADO);
}

function parseLugar(raw: unknown): string | undefined {
  const n = norm(raw);
  if (n.includes('fcyt') || n.includes('posgrado fcyt') || n.includes('direccion de posgrado')) return 'Posgrado FCyT';
  if (n.includes('eupg')) return 'EUPG';
  if (n.includes('publica') || n.includes('san simon') || n.includes('umss') || n.includes('publicas nacionales')) return 'Univ. públicas nacionales';
  if (n.includes('privada') || n.includes('privadas nacionales')) return 'Univ. privadas nacionales';
  if (n.includes('internacional') || n.includes('extranjero')) return 'Univ. internacionales';
  return matchCatalogo(raw, LUGARES_POSGRADO);
}

function parseFinanciamiento(raw: unknown): string | undefined {
  const n = norm(raw);
  if (n.includes('propio') || n.includes('propios') || n.includes('autofinanciad')) return 'Recursos propios';
  if (n.includes('beca') && (n.includes('total') || n.includes('completa'))) return 'Beca total';
  if (n.includes('beca') && (n.includes('parcial') || n.includes('medio') || n.includes('parcialmente'))) return 'Beca parcial';
  if (n.includes('beca')) return 'Beca parcial';
  return matchCatalogo(raw, FINANCIAMIENTOS);
}

function parseArea(raw: unknown): string | undefined {
  const n = norm(raw);
  if (n === 'ia' || n.includes('inteligencia artificial') || n.includes('machine learning') || n.includes('aprendizaje automatico')) return 'IA';
  if (n.includes('redes') || n.includes('seguridad') || n.includes('ciberseguridad')) return 'Redes de Datos y Seguridad';
  if (n.includes('base de datos') || n.includes('datos') || n.includes('data')) return 'Base de Datos';
  if (n.includes('software') || n.includes('ingenieria de software')) return 'Ingeniería de Software';
  if (n.includes('robotica') || n.includes('robotics')) return 'Robótica';
  return matchCatalogo(raw, AREAS_POSGRADO);
}

function parseInstitucion(raw: unknown): string | undefined {
  const n = norm(raw);
  if (n.includes('fcyt') || n.includes('posgrado fcyt')) return 'Posgrado FCyT';
  if (n.includes('eupg')) return 'EUPG';
  if (n.includes('publica') || n.includes('san simon') || n.includes('umss') || n.includes('publicas nacionales')) return 'Univ. públicas nacionales';
  if (n.includes('privada') || n.includes('privadas nacionales')) return 'Univ. privadas nacionales';
  if (n.includes('internacional') || n.includes('extranjero')) return 'Univ. internacionales';
  if (n.includes('ibnorca')) return 'IBNORCA';
  if (str(raw)) return 'Otro';
  return undefined;
}

function parseRubroTitulado(raw: unknown): string | undefined {
  const n = norm(raw);
  if (n.includes('software') || n.includes('desarrollo')) return 'Desarrollo de Software';
  if (n.includes('telecom') || n.includes('telecomunicacion')) return 'Telecomunicaciones';
  if (n.includes('redes') || n.includes('computadora')) return 'Redes de Computadoras';
  if (n.includes('banca') || n.includes('financiero') || n.includes('banco')) return 'Banca';
  if (n.includes('educacion') || n.includes('enseñanza') || n.includes('universidad') || n.includes('docencia')) return 'Educación';
  if (n.includes('salud') || n.includes('medico') || n.includes('hospital') || n.includes('clinica')) return 'Salud';
  if (str(raw)) return 'Otro';
  return undefined;
}

function parseCargo(raw: unknown): string | undefined {
  const n = norm(raw);
  if (n.includes('desarrollo') || n.includes('developer') || n.includes('programador') || n.includes('devops')) return 'Desarrollo';
  if (n.includes('ejecutivo') || n.includes('gerente') || n.includes('jefe') || n.includes('director') || n.includes('ceo')) return 'Ejecutivo';
  if (n.includes('tecnico') || n.includes('soporte') || n.includes('administrador')) return 'Técnico';
  if (n.includes('help desk') || n.includes('helpdesk') || n.includes('mesa de ayuda') || n.includes('mesa ayuda')) return 'Help Desk';
  if (str(raw)) return 'Otro';
  return undefined;
}

function parseMedioObtencion(raw: unknown): string | undefined {
  const n = norm(raw);
  if (n.includes('postulacion') || n.includes('convocatoria') || n.includes('concurso')) return 'Postulación competitiva (convocatorias públicas y privadas)';
  if (n.includes('recomendacion') || n.includes('referencia') || n.includes('conocido') || n.includes('contacto personal')) return 'Recomendación de terceros';
  if (n.includes('internet') || n.includes('red social') || n.includes('linkedin') || n.includes('plataforma')) return 'Internet y redes sociales';
  if (n.includes('escrito') || n.includes('audiovisual') || n.includes('periodico') || n.includes('radio') || n.includes('television')) return 'Medios escritos o audiovisuales';
  if (str(raw)) return 'Otros';
  return undefined;
}

function parseRemuneracion(raw: unknown): string | undefined {
  const n = norm(raw);
  if (n.includes('menor') || (n.includes('2500') && !n.includes('3500'))) return 'Menor a Bs. 2.500';
  if ((n.includes('2500') && n.includes('3500')) || n.includes('3501')) return 'Entre Bs. 2.500 - Bs. 3.500';
  if ((n.includes('3501') && n.includes('5000')) || (n.includes('3500') && n.includes('5000'))) return 'Entre Bs. 3.501 - Bs. 5.000';
  if ((n.includes('5001') && n.includes('7000')) || (n.includes('5000') && n.includes('7000'))) return 'Entre Bs. 5.001 - Bs. 7.000';
  if ((n.includes('7001') && n.includes('10000')) || (n.includes('7000') && n.includes('10000'))) return 'Entre Bs. 7.001 - Bs. 10.000';
  if (n.includes('mas de') || n.includes('10001') || n.includes('mas 10000')) return 'Más de Bs. 10.000';
  return matchCatalogo(raw, REMUNERACIONES);
}

function parseTiempoPrimerEmpleo(raw: unknown): string | undefined {
  const n = norm(raw);
  if (n.includes('ya trabajaba') || n.includes('antes de titularse') || n.includes('antes de graduarse')) return 'Ya trabajaba antes de titularse';
  if (n.includes('menos de 1 mes') || n.includes('menos 1 mes') || n.includes('menos un mes')) return 'Menos de 1 mes';
  if (n.includes('1') && n.includes('4') && n.includes('mes')) return 'Entre 1 - 4 meses';
  if (n.includes('4') && n.includes('8') && n.includes('mes')) return 'Entre 4 - 8 meses';
  if (n.includes('8') && n.includes('12') && n.includes('mes')) return 'Entre 8 - 12 meses';
  if (n.includes('mas de 12') || n.includes('más de 12') || n.includes('mas 12')) return 'Más de 12 meses';
  return matchCatalogo(raw, TIEMPOS_PRIMER_EMPLEO);
}

function parseNumeroEmpleos(raw: unknown): string | undefined {
  const s = str(raw).trim();
  if (s === '1') return '1';
  if (s === '2') return '2';
  if (s === '3') return '3';
  if (Number(s) > 3 || norm(s).includes('mas de 3') || norm(s).includes('mas de tres')) return 'Más de 3';
  return matchCatalogo(raw, NUMERO_EMPLEOS);
}

function convertirTitulado(row: Row) {
  const situacion_laboral = parseSituacion(row[49]);
  const nivel_realizado = parseNivel(row[17]);
  const lugar_realizado = parseLugar(row[20]);
  const financiamiento = parseFinanciamiento(row[23]);
  const area_interes = parseArea(row[32]);
  const institucion_preferida = parseInstitucion(row[35]);
  const rubro = parseRubroTitulado(str(row[55]) || str(row[58]));
  const cargo = parseCargo(str(row[73]) || str(row[76]));
  const medio_obtencion = parseMedioObtencion(row[87]);
  const remuneracion = parseRemuneracion(row[90]);
  const tiempo_primer_empleo = parseTiempoPrimerEmpleo(row[121]);
  const numero_empleos = parseNumeroEmpleos(row[124]);
  const actividades = parseLista(row[67], ACTIVIDADES);

  // Sector: col 61 viene "PRIVADO" / "PÚBLICO" en mayúsculas
  let sector = matchCatalogo(str(row[61]), SECTORES);
  if (!sector) {
    const n = norm(row[61]);
    if (n === 'privado' || n === 'privada') sector = 'Privado';
    else if (n === 'publico' || n === 'publica') sector = 'Público';
  }

  // satisfaccion_negocio col 104
  let satisfaccion_negocio = matchCatalogo(str(row[104]), SATISFACCIONES_NEGOCIO);
  if (!satisfaccion_negocio) {
    const n = norm(row[104]);
    if (n.includes('insatisfecho')) satisfaccion_negocio = 'Insatisfecho';
    else if (n.includes('algo') || n.includes('parcialmente')) satisfaccion_negocio = 'Algo satisfecho';
    else if (n.includes('satisfecho')) satisfaccion_negocio = 'Satisfecho';
  }

  // importancia_formacion_negocio col 109
  let importancia_formacion_negocio = matchCatalogo(str(row[109]), IMPORTANCIAS_FORMACION);
  if (!importancia_formacion_negocio) {
    const n = norm(row[109]);
    if (n.includes('muy')) importancia_formacion_negocio = 'Muy importante';
    else if (n.includes('poco') || n.includes('no muy') || n.includes('no tan')) importancia_formacion_negocio = 'Poco importante';
    else if (n.includes('importante')) importancia_formacion_negocio = 'Importante';
  }

  // financiamiento_negocio col 99
  let financiamiento_negocio = matchCatalogo(str(row[99]), FINANCIAMIENTOS_NEGOCIO);
  if (!financiamiento_negocio) {
    const n = norm(row[99]);
    if (n.includes('propio') || n === 'no') financiamiento_negocio = 'No, financiamiento propio';
    else if (n.includes('prestamo') || n.includes('banco')) financiamiento_negocio = 'Sí, mediante préstamos bancarios';
    else if (n.includes('inversor')) financiamiento_negocio = 'Sí, mediante inversores';
  }

  return {
    edad: matchCatalogo(str(row[8]), EDADES),
    genero: matchCatalogo(str(row[11]), GENEROS),
    formacion_complementaria: parseSiNo(row[14]),
    nivel_realizado,
    lugar_realizado,
    financiamiento,
    programa: str(row[26]) || undefined,
    interes_posgrado: parseSiNo(row[29]),
    area_interes,
    institucion_preferida,
    opinion_posgrado_fcyt: likertTitulado(row[40]),
    anios_vida_profesional: parseAnios(row[43]),
    anios_desempleado: parseAnios(row[46]),
    situacion_laboral,
    empresa: str(row[52]) || undefined,
    rubro,
    sector,
    departamento: matchCatalogo(str(row[64]), DEPARTAMENTOS),
    actividades,
    cargo,
    pertinencia_labores: likertTitulado(row[81]),
    antiguedad_trabajo: matchCatalogo(str(row[84]), ANTIGUEDADES),
    medio_obtencion,
    remuneracion,
    origen_emprendimiento: matchCatalogo(str(row[93]), ORIGENES_EMPRENDIMIENTO),
    entregable_negocio: matchCatalogo(str(row[96]), ENTREGABLES_NEGOCIO),
    financiamiento_negocio,
    satisfaccion_negocio,
    importancia_formacion_negocio,
    primer_empleo: parseSiNo(row[112]),
    razon_no_trabaja: matchCatalogo(str(row[115]), RAZONES_NO_TRABAJA),
    trabajo_previo_sistemas: parseSiNo(row[118]),
    tiempo_primer_empleo,
    numero_empleos,
    satisfaccion_global: likertTitulado(row[129]),
    concordancia_formacion: likertTitulado(row[134]),
    aspectos_utiles: parseLista(row[137], ASPECTOS_UTILES),
    aspectos_mejorar: parseLista(row[140], ASPECTOS_MEJORAR),
    asignaturas_ventaja: parseLista(row[143], ASIGNATURAS_VENTAJA),
    asignaturas_no_utiles: parseLista(row[149], ASIGNATURAS_NO_UTILES),
    red_contactos: parseSiNo(row[155]),
    segmento: undefined as string | undefined,
  };
}

// ── Converter: Empleadores ────────────────────────────────────────────────────
function convertirEmpleador(row: Row) {
  // Cargos col 10: lista separada por comas con texto largo de Google Forms
  const cargosRaw = str(row[10]);
  const cargos: string[] = [];
  const nCar = norm(cargosRaw);
  if (nCar.includes('tecnico')) cargos.push('Técnico');
  if (nCar.includes('analista')) cargos.push('Analista');
  if (nCar.includes('especialista')) cargos.push('Especialista');
  if (nCar.includes('supervisor') || nCar.includes('coordinador')) cargos.push('Supervisor / coordinador');
  if (nCar.includes('jefatura') || nCar.includes('gerencia') || nCar.includes('gerente') || nCar.includes('gerencial')) cargos.push('Jefatura o gerencial');
  if (nCar.includes('consultor')) cargos.push('Consultor tecnológico');
  if (nCar.includes('apoyo') || nCar.includes('asistencia')) cargos.push('Apoyo / asistencia tecnológica');
  // Si no detectó ninguno, probar matchCatalogo en partes
  if (cargos.length === 0) {
    for (const p of cargosRaw.split(/,/).map(s => s.trim()).filter(s => s)) {
      const m = matchCatalogo(p, CARGOS_EMPLEADOR);
      if (m && !cargos.includes(m)) cargos.push(m);
    }
  }

  // posibilidad_contratacion
  // Valores exactos del form:
  // "Sí, existe una alta probabilidad de contratación"
  // "Sí, dependiendo del crecimiento o nuevos proyectos de la organización"
  // "No se tiene prevista la contratación actualmente"
  const nPosi = norm(row[7]);
  let posibilidad_contratacion: string | undefined;
  if (nPosi.includes('alta probabilidad') || nPosi.includes('alta prob')) posibilidad_contratacion = 'Alta probabilidad';
  else if (nPosi.includes('crecimiento') || nPosi.includes('proyectos') || nPosi.includes('dependiendo')) posibilidad_contratacion = 'Depende del crecimiento / proyectos';
  else if (nPosi.includes('no se tiene') || nPosi.includes('no prevista') || nPosi.includes('no tiene prevista')) posibilidad_contratacion = 'No prevista actualmente';
  else posibilidad_contratacion = matchCatalogo(row[7], POSIBILIDADES_CONTRATACION);

  // tamano
  const nTam = norm(row[4]);
  let tamano: string | undefined;
  if (nTam.includes('grande') || (nTam.includes('100') && !nTam.includes('1000'))) tamano = 'Grande';
  else if (nTam.includes('mediana') || (nTam.includes('31') && nTam.includes('99'))) tamano = 'Mediana';
  else if (nTam.includes('pequena') || nTam.includes('pequeña') || (nTam.includes('11') && nTam.includes('30'))) tamano = 'Pequeña';
  else if (nTam.includes('micro') || (nTam.includes('1') && nTam.includes('10') && !nTam.includes('11'))) tamano = 'Micro';
  else tamano = matchCatalogo(row[4], TAMANOS_EMPRESA);

  // rubro empleador
  const nRub = norm(row[5]);
  let rubro: string | undefined;
  if (nRub.includes('soporte')) rubro = 'Soporte técnico y mantenimiento de sistemas';
  else if (nRub.includes('servicios de tecnolog') || nRub.includes(' ti ') || nRub === 'ti') rubro = 'Servicios de tecnologías de información (TI)';
  else if (nRub.includes('desarrollo de software')) rubro = 'Desarrollo de software';
  else if (nRub.includes('publica') || nRub.includes('gobierno') || nRub.includes('estatal')) rubro = 'Instituciones públicas / gobierno';
  else if (nRub.includes('educacion') || nRub.includes('investigacion') || nRub.includes('universidad')) rubro = 'Educación e investigación';
  else if (nRub.includes('banca') || nRub.includes('financiero')) rubro = 'Banca y servicios financieros';
  else if (nRub.includes('consultoria')) rubro = 'Consultoría en sistemas / transformación digital';
  else if (nRub.includes('telecomunicacion') || nRub.includes('redes')) rubro = 'Telecomunicaciones y redes';
  else if (nRub.includes('salud') || nRub.includes('medico') || nRub.includes('hospital')) rubro = 'Salud';
  else if (nRub.includes('industria') || nRub.includes('manufactura')) rubro = 'Industria y manufactura';
  else if (nRub.includes('comercio') || nRub.includes('ecommerce')) rubro = 'Comercio y comercio electrónico';
  else if (nRub.includes('startup') || nRub.includes('emprendimiento')) rubro = 'Startups o emprendimientos tecnológicos';
  else rubro = matchCatalogo(row[5], RUBROS_EMPLEADOR) ?? (str(row[5]) ? 'Otros' : undefined);

  // medio_convocatoria
  const nMed = norm(row[9]);
  let medio_convocatoria: string | undefined;
  if (nMed.includes('internet') || nMed.includes('red social') || nMed.includes('linkedin')) medio_convocatoria = 'Internet y redes sociales';
  else if (nMed.includes('postulacion') || nMed.includes('convocatoria') || nMed.includes('concurso')) medio_convocatoria = 'Postulación competitiva';
  else if (nMed.includes('recomendacion') || nMed.includes('referencia') || nMed.includes('contacto')) medio_convocatoria = 'Recomendación de terceros';
  else if (nMed.includes('escrito') || nMed.includes('audiovisual')) medio_convocatoria = 'Medios escritos y audiovisuales';
  else medio_convocatoria = matchCatalogo(row[9], MEDIOS_CONVOCATORIA);

  // tipo: col 3 viene "Público" / "Privado" correctamente capitalizado
  const tipo = matchCatalogo(str(row[3]), TIPOS_ORGANIZACION) ??
    (norm(row[3]).includes('public') ? 'Público' : norm(row[3]).includes('privad') ? 'Privado' : undefined);

  // nivel_demandado: col 8 viene "Licenciatura", "Diplomado", "Especialidad", "Maestría"
  const nivel_demandado = matchCatalogo(str(row[8]), NIVELES_DEMANDADOS);

  // contrato_5_anios: col 6 viene "SI" / "No"
  const contrato_5_anios = norm(row[6]) === 'si' ? 'Sí' : norm(row[6]) === 'no' ? 'No' : parseSiNo(row[6]);

  // 18 items likert (columnas 14 a 31)
  const items_likert: Record<string, string> = {};
  for (let i = 0; i < 18; i++) {
    const codigo = `item_${String(i + 1).padStart(2, '0')}`;
    const val = likertEmpleador(row[14 + i]);
    if (val) items_likert[codigo] = val;
  }

  return {
    organizacion: str(row[2]) || undefined,
    tipo,
    tamano,
    rubro,
    contrato_5_anios,
    posibilidad_contratacion,
    nivel_demandado,
    medio_convocatoria,
    cargos,
    tendencias: str(row[11]) || undefined,
    habilidades: str(row[13]) || undefined,
    items_likert,
  };
}

// ── Lectura de archivos Excel ─────────────────────────────────────────────────
console.log('📂 Leyendo Excel de Titulados...');
const bufTitulados = readFileSync(RUTA_TITULADOS);
const bufEmpleadores = readFileSync(RUTA_EMPLEADORES);

const wbT = XLSX.read(bufTitulados);
const wsT = wbT.Sheets[wbT.SheetNames[0]];
const rawTitulados = XLSX.utils.sheet_to_json(wsT, { header: 1, defval: '' }) as Row[];

const wbE = XLSX.read(bufEmpleadores);
const wsE = wbE.Sheets[wbE.SheetNames[0]];
const rawEmpleadores = XLSX.utils.sheet_to_json(wsE, { header: 1, defval: '' }) as Row[];

// ── Parsear filas ─────────────────────────────────────────────────────────────
const titulados: ReturnType<typeof convertirTitulado>[] = [];
let skippedT = 0;
for (let i = 1; i < rawTitulados.length; i++) {
  const row = rawTitulados[i];
  if (!str(row[8])) { skippedT++; continue; }
  try {
    const t = convertirTitulado(row);
    if (!t.edad || !t.genero || !t.formacion_complementaria || !t.situacion_laboral) {
      console.warn(`[Titulado fila ${i + 1}] Faltan campos obligatorios:`, {
        edad: t.edad, genero: t.genero,
        formacion_complementaria: t.formacion_complementaria,
        situacion_laboral: t.situacion_laboral,
        raw_situacion: str(row[49])
      });
      skippedT++;
      continue;
    }
    // Corregir inconsistencia: anios_desempleado > anios_vida_profesional
    if (t.anios_desempleado !== undefined && t.anios_vida_profesional !== undefined
        && t.anios_desempleado > t.anios_vida_profesional) {
      console.warn(`[Titulado fila ${i + 1}] Ajuste: desempleado(${t.anios_desempleado}) > vida(${t.anios_vida_profesional}) → se corrige a igual`);
      t.anios_desempleado = t.anios_vida_profesional;
    }
    titulados.push(t);
  } catch (e) {
    console.warn(`[Titulado fila ${i + 1}] Error:`, (e as Error).message);
    skippedT++;
  }
}

const empleadores: ReturnType<typeof convertirEmpleador>[] = [];
let skippedE = 0;
for (let i = 1; i < rawEmpleadores.length; i++) {
  const row = rawEmpleadores[i];
  if (!str(row[2]) || str(row[2]).length < 2) { skippedE++; continue; } // sin nombre o muy corto
  try {
    const e = convertirEmpleador(row);
    if (!e.tipo) {
      console.warn(`[Empleador fila ${i + 1}] Sin tipo de organización:`, str(row[3]));
      skippedE++;
      continue;
    }
    empleadores.push(e);
  } catch (e2) {
    console.warn(`[Empleador fila ${i + 1}] Error:`, (e2 as Error).message);
    skippedE++;
  }
}

console.log(`\n📋 Titulados parseados: ${titulados.length} (descartados: ${skippedT})`);
console.log(`📋 Empleadores parseados: ${empleadores.length} (descartados: ${skippedE})`);

// ── Cargar en PostgreSQL ──────────────────────────────────────────────────────
console.log('\n🔌 Conectando a PostgreSQL...');

await enTransaccion(async (cliente) => {
  // 1. Borrar SOLO los registros de formulario previos (preservar base_oficial)
  console.log('🗑️  Eliminando registros anteriores de formularios...');

  await cliente.query(`DELETE FROM titulado_actividad          WHERE titulado_id IN (SELECT id FROM titulados WHERE origen = 'formulario')`);
  await cliente.query(`DELETE FROM titulado_aspecto_util       WHERE titulado_id IN (SELECT id FROM titulados WHERE origen = 'formulario')`);
  await cliente.query(`DELETE FROM titulado_aspecto_mejorar    WHERE titulado_id IN (SELECT id FROM titulados WHERE origen = 'formulario')`);
  await cliente.query(`DELETE FROM titulado_asignatura_ventaja WHERE titulado_id IN (SELECT id FROM titulados WHERE origen = 'formulario')`);
  await cliente.query(`DELETE FROM titulado_asignatura_no_util WHERE titulado_id IN (SELECT id FROM titulados WHERE origen = 'formulario')`);
  await cliente.query(`DELETE FROM titulados WHERE origen = 'formulario'`);
  await cliente.query(`DELETE FROM respuestas_empleador WHERE empleador_id IN (SELECT id FROM empleadores WHERE origen = 'formulario')`);
  await cliente.query(`DELETE FROM empleador_cargo       WHERE empleador_id IN (SELECT id FROM empleadores WHERE origen = 'formulario')`);
  await cliente.query(`DELETE FROM empleadores WHERE origen = 'formulario'`);

  console.log('✅ Registros anteriores eliminados.');

  // 2. Leer IDs de catálogos
  const ids = await leerIds(cliente);

  // 3. Insertar titulados (SAVEPOINT por registro para aislar errores individuales)
  console.log(`\n⬆️  Insertando ${titulados.length} titulados...`);
  let insertadosT = 0;
  let errorT = 0;
  for (let idx = 0; idx < titulados.length; idx++) {
    const t = titulados[idx];
    await cliente.query(`SAVEPOINT sp_t_${idx}`);
    try {
      await insertarTitulado(
        cliente, ids,
        t as Parameters<typeof insertarTitulado>[2],
        { origen: 'formulario' } as DatosInsercion
      );
      await cliente.query(`RELEASE SAVEPOINT sp_t_${idx}`);
      insertadosT++;
    } catch (e) {
      await cliente.query(`ROLLBACK TO SAVEPOINT sp_t_${idx}`);
      console.warn(`  ⚠️ Titulado #${idx + 1}:`, (e as Error).message.substring(0, 150));
      errorT++;
    }
  }
  console.log(`  ✅ ${insertadosT} titulados insertados, ${errorT} con error.`);

  // 4. Insertar empleadores (SAVEPOINT por registro)
  console.log(`\n⬆️  Insertando ${empleadores.length} empleadores...`);
  let insertadosE = 0;
  let errorE = 0;
  for (let idx = 0; idx < empleadores.length; idx++) {
    const e = empleadores[idx];
    await cliente.query(`SAVEPOINT sp_e_${idx}`);
    try {
      await insertarEmpleador(
        cliente, ids,
        e as Parameters<typeof insertarEmpleador>[2],
        { origen: 'formulario' } as DatosInsercion
      );
      await cliente.query(`RELEASE SAVEPOINT sp_e_${idx}`);
      insertadosE++;
    } catch (e2) {
      await cliente.query(`ROLLBACK TO SAVEPOINT sp_e_${idx}`);
      console.warn(`  ⚠️ Empleador #${idx + 1} (${str(empleadores[idx].organizacion)}):`, (e2 as Error).message.substring(0, 150));
      errorE++;
    }
  }
  console.log(`  ✅ ${insertadosE} empleadores insertados, ${errorE} con error.`);

  console.log('\n🎉 ¡Carga completada exitosamente!');
});

// Verificación final
const { rows: totales } = await pool.query(`
  SELECT 'titulados' as tabla, origen, count(*)::int as total FROM titulados GROUP BY origen
  UNION ALL
  SELECT 'empleadores', origen, count(*)::int FROM empleadores GROUP BY origen
  ORDER BY tabla, origen
`);
console.log('\n📊 Estado final de la base de datos:');
for (const r of totales) {
  console.log(`  ${r.tabla} [${r.origen}]: ${r.total}`);
}

await pool.end();
console.log('\n🔌 Conexión cerrada.');
