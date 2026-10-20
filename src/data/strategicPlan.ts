/**
 * Datos Estratégicos, Matrices ARCU-SUR y Afirmaciones de Empleadores
 * Informe Actividad 2 - Taller de Simulación de Sistemas (Grupo 14)
 */

import { AfirmacionEmpleador } from '../types';

export const AFIRMACIONES_EMPLEADORES: AfirmacionEmpleador[] = [
  {
    numero: 1,
    id: 'item_01',
    texto: 'La Carrera brinda confianza como formadora de profesionales del área tecnológica',
    dimension: 'Confianza y calidad del perfil'
  },
  {
    numero: 2,
    id: 'item_02',
    texto: 'El título es consistente con el nivel de formación y las competencias demostradas',
    dimension: 'Confianza y calidad del perfil'
  },
  {
    numero: 3,
    id: 'item_03',
    texto: 'Las autoridades de la Carrera consultan regularmente nuestra opinión',
    dimension: 'Vinculación con empleadores'
  },
  {
    numero: 4,
    id: 'item_04',
    texto: 'Conozco el perfil profesional y las competencias de egreso',
    dimension: 'Conocimiento del perfil'
  },
  {
    numero: 5,
    id: 'item_05',
    texto: 'El perfil profesional es coherente con el desempeño laboral de los titulados',
    dimension: 'Confianza y calidad del perfil'
  },
  {
    numero: 6,
    id: 'item_06',
    texto: 'La formación permite un desempeño destacado, profesional e integral',
    dimension: 'Confianza y calidad del perfil'
  },
  {
    numero: 7,
    id: 'item_07',
    texto: 'La Carrera incorpora las necesidades del sector en prácticas, pasantías y titulación',
    dimension: 'Vinculación con empleadores'
  },
  {
    numero: 8,
    id: 'item_08',
    texto: 'Los titulados evidencian competencias laborales (comunicación, análisis, equipo, TI)',
    dimension: 'Confianza y calidad del perfil'
  },
  {
    numero: 9,
    id: 'item_09',
    texto: 'Los titulados demuestran valores: ética, responsabilidad social, inclusión, ambiente',
    dimension: 'Confianza y calidad del perfil'
  },
  {
    numero: 10,
    id: 'item_10',
    texto: 'He participado en procesos de evaluación o retroalimentación sobre los titulados',
    dimension: 'Participación en mejora de la carrera'
  },
  {
    numero: 11,
    id: 'item_11',
    texto: 'La Carrera mantiene vínculos que generan oportunidades laborales para los titulados',
    dimension: 'Vinculación con empleadores'
  },
  {
    numero: 12,
    id: 'item_12',
    texto: 'He participado en actividades de vinculación con el entorno laboral y tecnológico',
    dimension: 'Participación en mejora de la carrera'
  },
  {
    numero: 13,
    id: 'item_13',
    texto: 'He participado en difusión de oportunidades laborales, convocatorias o pasantías',
    dimension: 'Participación en mejora de la carrera'
  },
  {
    numero: 14,
    id: 'item_14',
    texto: 'He participado en actividades de intercambio entre profesionales, empleadores, docentes y estudiantes',
    dimension: 'Participación en mejora de la carrera'
  },
  {
    numero: 15,
    id: 'item_15',
    texto: 'He sido consultado sobre el desempeño de los titulados para retroalimentar el plan de estudios',
    dimension: 'Participación en mejora de la carrera'
  },
  {
    numero: 16,
    id: 'item_16',
    texto: 'La Carrera ha consultado nuestra opinión sobre la pertinencia de la formación',
    dimension: 'Vinculación con empleadores'
  },
  {
    numero: 17,
    id: 'item_17',
    texto: 'Recurrimos a la UMSS y a la Carrera como fuente de talento profesional',
    dimension: 'Vinculación con empleadores'
  },
  {
    numero: 18,
    id: 'item_18',
    texto: 'He sido consultado periódicamente durante la autoevaluación y mejora continua',
    dimension: 'Participación en mejora de la carrera'
  }
];

/** Nombre corto de cada afirmación, para ejes y etiquetas de gráficos. */
export const NOMBRE_CORTO_AFIRMACION: Record<number, string> = {
  1: 'Confianza en la Carrera',
  2: 'Título consistente',
  3: 'Consulta de opinión',
  4: 'Conoce el perfil',
  5: 'Perfil coherente',
  6: 'Desempeño destacado',
  7: 'Necesidades del sector',
  8: 'Competencias laborales',
  9: 'Valores',
  10: 'Evaluación de titulados',
  11: 'Vínculos laborales',
  12: 'Vinculación con el entorno',
  13: 'Difusión de ofertas',
  14: 'Intercambio profesional',
  15: 'Consulta sobre desempeño',
  16: 'Consulta de pertinencia',
  17: 'Fuente de talento',
  18: 'Autoevaluación'
};

/** Afirmaciones del radar "Valoración de los empleadores" (confianza y conocimiento del perfil). */
export const AFIRMACIONES_RADAR = [1, 2, 4, 5, 6, 8, 9];

export const DIMENSIONES_EMPLEADORES = [
  {
    dimension: 'Confianza y calidad del perfil de egreso',
    afirmaciones: [1, 2, 5, 6, 8, 9],
    indiceReportado: 64.4,
    diagnostico: 'Alta confianza institucional (86%) y reconocimiento de sólidos valores éticos y rigor analítico.'
  },
  {
    dimension: 'Conocimiento del perfil profesional',
    afirmaciones: [4],
    indiceReportado: 65.6,
    diagnostico: 'Claridad aceptable sobre el rol del egresado, aunque requiere mayor difusión con empresas emergentes.'
  },
  {
    dimension: 'Vinculación de la Carrera con los empleadores',
    afirmaciones: [3, 7, 11, 16, 17],
    indiceReportado: 43.8,
    diagnostico: 'Punto débil: 43% afirma que la carrera no consulta la pertinencia laboral y no hay bolsa institucional activa.'
  },
  {
    dimension: 'Participación del empleador en la mejora de la Carrera',
    afirmaciones: [10, 12, 13, 14, 15, 18],
    indiceReportado: 34.5,
    diagnostico: 'Brecha más crítica para ARCU-SUR: 49% nunca fue consultado en la autoevaluación y ~40% no participa en ninguna actividad.'
  }
];

export const INFO_INSTITUCIONAL = {
  universidad: 'Universidad Mayor de San Simón (UMSS)',
  facultad: 'Facultad de Ciencias y Tecnología',
  carrera: 'Carrera de Ingeniería de Sistemas',
  materia: 'Taller de Simulación de Sistemas',
  actividad: 'Actividad 2: Análisis de Mercado y Simulación Estocástica',
  grupo: 'Grupo 14',
  integrantes: [
    'Aguilar Condori Alvaro',
    'Choque Calle Gabriel',
    'Muraña Mamani Jose'
  ],
  docente: 'Ing. Henrry Frank Villarroel Tapia',
  fecha: 'Octubre de 2026',
  ubicacion: 'Cochabamba – Bolivia',
  cartas: [
    {
      codigo: 'DIR SIS 141/2026',
      fecha: '30 de septiembre de 2026',
      destinatario: 'A quien corresponda (Instituciones con titulados de la Carrera)',
      firmante: 'MSc. Yony Richard Montoya Burgos - Director de Carrera'
    },
    {
      codigo: 'DIR SIS 143/2026',
      fecha: '05 de octubre de 2026',
      destinatario: 'A quien corresponda (Instituciones Empleadoras)',
      firmante: 'MSc. Yony Richard Montoya Burgos - Director de Carrera'
    }
  ]
};
