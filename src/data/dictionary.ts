/**
 * Diccionario de Datos Oficial de la Carrera de Ingeniería de Sistemas (UMSS)
 * Anexo C del Informe Técnico - Grupo 14
 */

export interface VariableDef {
  codigo: string;
  nombre: string;
  tipo: 'Categórica' | 'Numérica' | 'Likert' | 'Selección múltiple' | 'Texto libre';
  descripcion: string;
  valoresPosibles: string;
}

export const DICCIONARIO_TITULADOS: VariableDef[] = [
  {
    codigo: 'edad',
    nombre: 'Rango de Edad',
    tipo: 'Categórica',
    descripcion: 'Grupo etario del titulado al momento del relevamiento',
    valoresPosibles: '19-22 años, 23-26 años, 27-30 años, 31-34 años, 35 años o más'
  },
  {
    codigo: 'genero',
    nombre: 'Género',
    tipo: 'Categórica',
    descripcion: 'Género autoidentificado',
    valoresPosibles: 'Masculino (77.7%), Femenino (22.3%)'
  },
  {
    codigo: 'anios_vida_profesional',
    nombre: 'Años de Vida Profesional',
    tipo: 'Numérica',
    descripcion: 'Tiempo transcurrido desde la graduación formal o inserción en la profesión (en años)',
    valoresPosibles: '0.0 a 35.0 años (Media: 8.83, Mediana: 6.0)'
  },
  {
    codigo: 'anios_desempleado',
    nombre: 'Años de Desempleo Acumulado',
    tipo: 'Numérica',
    descripcion: 'Período total acumulado sin empleo formal durante la trayectoria profesional',
    valoresPosibles: '0.0 a 5.0 años (42% reporta 0 años, mediana 0.75 años)'
  },
  {
    codigo: 'formacion_complementaria',
    nombre: 'Realizó Formación Continua',
    tipo: 'Categórica',
    descripcion: 'Indica si cursó diplomados, maestrías o especializaciones posteriores',
    valoresPosibles: 'Sí (66.2%), No (33.8%)'
  },
  {
    codigo: 'nivel_realizado',
    nombre: 'Nivel Máximo Cursado',
    tipo: 'Categórica',
    descripcion: 'Grado del programa de posgrado realizado',
    valoresPosibles: 'Diplomado (67.3%), Maestría (27.6%), Especialidad (3.1%), Doctorado (2.0%)'
  },
  {
    codigo: 'financiamiento',
    nombre: 'Fuente de Financiamiento',
    tipo: 'Categórica',
    descripcion: 'Modalidad de cobertura económica de los estudios de posgrado',
    valoresPosibles: 'Recursos propios (91.8%), Beca parcial (5.1%), Beca total (3.1%)'
  },
  {
    codigo: 'interes_posgrado',
    nombre: 'Interés en Nuevos Posgrados',
    tipo: 'Categórica',
    descripcion: 'Disposición activa para matricularse en programas de posgrado',
    valoresPosibles: 'Sí (83.1%), No (16.9%)'
  },
  {
    codigo: 'area_interes',
    nombre: 'Área Tecnológica Preferida',
    tipo: 'Categórica',
    descripcion: 'Especialidad tecnológica priorizada por el titulado',
    valoresPosibles: 'IA (43.9%), Ing. de Software (23.6%), Redes y Seguridad (20.3%), Base de Datos (8.1%), Robótica (4.1%)'
  },
  {
    codigo: 'institucion_preferida',
    nombre: 'Institución de Preferencia',
    tipo: 'Categórica',
    descripcion: 'Centro académico seleccionado para cursar posgrados',
    valoresPosibles: 'Posgrado FCyT (30.9%), Univ. internacionales (25.2%), Univ. públicas (13.8%), EUPG (10.6%), Univ. privadas (8.1%), IBNORCA (2.4%)'
  },
  {
    codigo: 'situacion_laboral',
    nombre: 'Situación Laboral Actual',
    tipo: 'Categórica',
    descripcion: 'Condición ocupacional en el momento de la encuesta',
    valoresPosibles: 'Trabaja en organización (73.0%), Emprendimiento (10.1%), No trabaja (16.9%)'
  },
  {
    codigo: 'sector',
    nombre: 'Sector Institucional',
    tipo: 'Categórica',
    descripcion: 'Naturaleza jurídica del empleador',
    valoresPosibles: 'Sector privado (80.6%), Sector público (19.4%)'
  },
  {
    codigo: 'rubro',
    nombre: 'Rubro de la Empresa',
    tipo: 'Categórica',
    descripcion: 'Actividad económica principal del centro de trabajo',
    valoresPosibles: 'Desarrollo de Software (62%), Telecomunicaciones (11%), Banca (8%), Redes (8%), Educación (6%), Salud (4%)'
  },
  {
    codigo: 'tiempo_primer_empleo',
    nombre: 'Tiempo para Primer Empleo',
    tipo: 'Categórica',
    descripcion: 'Demora en meses para colocarse en el mercado laboral profesional',
    valoresPosibles: 'Ya trabajaba (52.5%), <1 mes (9.9%), 1-4 meses (13.9%), 4-8 meses (5.9%), 8-12 meses (12.9%), >12 meses (5.0%)'
  },
  {
    codigo: 'remuneracion',
    nombre: 'Rango Salarial Mensual (Bs)',
    tipo: 'Categórica',
    descripcion: 'Ingresos líquidos mensuales en moneda nacional',
    valoresPosibles: '<2500, 2500-3500, 3501-5000, 5001-7000, 7001-10000, >10000'
  },
  {
    codigo: 'satisfaccion_global',
    nombre: 'Satisfacción con Formación',
    tipo: 'Likert',
    descripcion: 'Valoración global de la formación universitaria recibida (1 a 4)',
    valoresPosibles: '1: TD, 2: D, 3: A, 4: TA (Media: 2.78, 74.1% acuerdo)'
  },
  {
    codigo: 'concordancia_formacion',
    nombre: 'Concordancia con Requerimientos',
    tipo: 'Likert',
    descripcion: 'Alineación entre lo enseñado en aula y las exigencias del puesto de trabajo',
    valoresPosibles: '1: TD, 2: D, 3: A, 4: TA (Media: 2.63, 61.9% acuerdo)'
  },
  {
    codigo: 'pertinencia_labores',
    nombre: 'Pertinencia de Labores',
    tipo: 'Likert',
    descripcion: 'Correspondencia directa de las funciones desempeñadas con Ing. de Sistemas',
    valoresPosibles: '1: TD, 2: D, 3: A, 4: TA (Media: 3.25, 90.7% acuerdo)'
  }
];

export const DICCIONARIO_EMPLEADORES: VariableDef[] = [
  {
    codigo: 'tipo',
    nombre: 'Naturaleza del Empleador',
    tipo: 'Categórica',
    descripcion: 'Sector de la empresa u organismo empleador',
    valoresPosibles: 'Sector privado (76.5%), Sector público (23.5%)'
  },
  {
    codigo: 'tamano',
    nombre: 'Tamaño de Empresa',
    tipo: 'Categórica',
    descripcion: 'Número de empleados totales',
    valoresPosibles: 'Gran empresa (37.3%), Micro empresa (33.3%), Mediana (15.7%), Pequeña (13.7%)'
  },
  {
    codigo: 'rubro',
    nombre: 'Rubro Principal',
    tipo: 'Categórica',
    descripcion: 'Actividad empresarial central',
    valoresPosibles: 'Desarrollo de Software (41%), Startups (8%), Telecomunicaciones (8%), Otros (8%), etc.'
  },
  {
    codigo: 'contrato_5_anios',
    nombre: 'Contrató en últimos 5 años',
    tipo: 'Categórica',
    descripcion: 'Historial reciente de contratación de titulados de Sistemas UMSS',
    valoresPosibles: 'Sí (80.4%), No (19.6%)'
  },
  {
    codigo: 'posibilidad_contratacion',
    nombre: 'Expectativa de Nuevas Contrataciones',
    tipo: 'Categórica',
    descripcion: 'Previsión de contratar ingenieros en los próximos períodos',
    valoresPosibles: 'Alta probabilidad (29%), Depende de proyectos (51%), No prevista (20%)'
  },
  {
    codigo: 'nivel_demandado',
    nombre: 'Grado Académico Exigido',
    tipo: 'Categórica',
    descripcion: 'Nivel mínimo para postularse a los cargos de sistemas',
    valoresPosibles: 'Licenciatura (72.5%), Especialidad (15.7%), Diplomado (7.8%), Maestría (3.9%)'
  },
  {
    codigo: 'tendencias_texto',
    nombre: 'Tendencias Tecnológicas Demandadas',
    tipo: 'Texto libre',
    descripcion: 'Tecnologías emergentes citadas espontáneamente por directores y gerentes',
    valoresPosibles: 'Inteligencia Artificial / Agentes (82%), Web/APIs (32%), Ciberseguridad (28%), Nube/DevOps (24%)'
  },
  {
    codigo: 'habilidades_texto',
    nombre: 'Competencias Blandas Clave',
    tipo: 'Texto libre',
    descripcion: 'Habilidades no técnicas valoradas en el ejercicio laboral',
    valoresPosibles: 'Adaptabilidad/Aprendizaje continuo (31%), Trabajo en equipo (25%), Resolución problemas (24%)'
  },
  {
    codigo: 'item_01 a item_18',
    nombre: '18 Afirmaciones de Evaluación ARCU-SUR',
    tipo: 'Likert',
    descripcion: 'Evaluación del empleador en escala de 4 niveles sobre la carrera',
    valoresPosibles: 'Totalmente de acuerdo, Parcialmente de acuerdo, Totalmente en desacuerdo, No sabe'
  }
];
