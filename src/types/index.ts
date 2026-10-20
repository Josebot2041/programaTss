/**
 * Tipos de datos para el Observatorio y Simulador de Mercado
 * Carrera de Ingeniería de Sistemas - UMSS
 * Enfoque de Acreditación ARCU-SUR (Taller de Simulación de Sistemas)
 *
 * Los nombres de los campos coinciden con las columnas de la base real
 * (Base_Limpia_Titulados_Empleadores.xlsx) para que importar y exportar sea simétrico.
 * Un campo opcional sin valor significa "sin respuesta" o "no aplica".
 */

import type {
  Actividad,
  Antiguedad,
  AreaPosgrado,
  AsignaturaNoUtil,
  AsignaturaVentaja,
  AspectoMejorar,
  AspectoUtil,
  CargoEmpleador,
  CargoTitulado,
  Departamento,
  Edad,
  EntregableNegocio,
  Financiamiento,
  FinanciamientoNegocio,
  Genero,
  ImportanciaFormacion,
  InstitucionPreferida,
  Likert,
  LikertEmpleador,
  LugarPosgrado,
  MedioConvocatoria,
  MedioObtencion,
  NivelDemandado,
  NivelPosgrado,
  NumeroEmpleos,
  OrigenEmprendimiento,
  PosibilidadContratacion,
  RazonNoTrabaja,
  Remuneracion,
  RubroEmpleador,
  RubroTitulado,
  SatisfaccionNegocio,
  Sector,
  Segmento,
  SiNo,
  SituacionLaboral,
  TamanoEmpresa,
  TiempoPrimerEmpleo,
  TipoOrganizacion
} from '../data/catalogos';

export interface Titulado {
  id: string;
  edad: Edad;
  genero: Genero;
  formacion_complementaria: SiNo;
  nivel_realizado?: NivelPosgrado;
  lugar_realizado?: LugarPosgrado;
  financiamiento?: Financiamiento;
  programa?: string;
  interes_posgrado?: SiNo;
  area_interes?: AreaPosgrado;
  institucion_preferida?: InstitucionPreferida;
  opinion_posgrado_fcyt?: Likert;
  anios_vida_profesional?: number;
  anios_desempleado?: number;
  situacion_laboral: SituacionLaboral;
  empresa?: string;
  rubro?: RubroTitulado;
  sector?: Sector;
  departamento?: Departamento;
  actividades: Actividad[];
  cargo?: CargoTitulado;
  pertinencia_labores?: Likert;
  antiguedad_trabajo?: Antiguedad;
  medio_obtencion?: MedioObtencion;
  remuneracion?: Remuneracion;
  origen_emprendimiento?: OrigenEmprendimiento;
  entregable_negocio?: EntregableNegocio;
  financiamiento_negocio?: FinanciamientoNegocio;
  satisfaccion_negocio?: SatisfaccionNegocio;
  importancia_formacion_negocio?: ImportanciaFormacion;
  primer_empleo?: SiNo;
  razon_no_trabaja?: RazonNoTrabaja;
  trabajo_previo_sistemas?: SiNo;
  tiempo_primer_empleo?: TiempoPrimerEmpleo;
  numero_empleos?: NumeroEmpleos;
  satisfaccion_global?: Likert;
  concordancia_formacion?: Likert;
  aspectos_utiles: AspectoUtil[];
  aspectos_mejorar: AspectoMejorar[];
  asignaturas_ventaja: AsignaturaVentaja[];
  asignaturas_no_utiles: AsignaturaNoUtil[];
  red_contactos?: SiNo;
  /** Derivado de anios_vida_profesional (no es una columna de la base). */
  segmento?: Segmento;
}

export interface Empleador {
  id: string;
  organizacion: string;
  tipo: TipoOrganizacion;
  tamano: TamanoEmpresa;
  rubro?: RubroEmpleador;
  contrato_5_anios?: SiNo;
  posibilidad_contratacion?: PosibilidadContratacion;
  nivel_demandado?: NivelDemandado;
  medio_convocatoria?: MedioConvocatoria;
  cargos: CargoEmpleador[];
  /** Pregunta abierta: tecnologías y tendencias que considera indispensables. */
  tendencias?: string;
  /** Pregunta abierta: habilidades más valoradas. */
  habilidades?: string;
  /** Respuestas a las 18 afirmaciones, por código (item_01 … item_18). */
  items_likert: Partial<Record<string, LikertEmpleador>>;
}

/** Fila de la hoja Items_empleadores. */
export interface ItemEmpleador {
  codigo: string;
  afirmacion: string;
}

export interface AfirmacionEmpleador {
  numero: number;
  id: string;
  texto: string;
  dimension: 'Confianza y calidad del perfil' | 'Conocimiento del perfil' | 'Vinculación con empleadores' | 'Participación en mejora de la carrera';
}
