/**
 * Validación de las encuestas cargadas desde los formularios.
 * Los formularios empiezan vacíos: un campo sin elegir es "sin respuesta", nunca un valor por defecto.
 */

import {
  AREAS_POSGRADO,
  ASIGNATURAS_NO_UTILES,
  ASIGNATURAS_VENTAJA,
  CARGOS_EMPLEADOR,
  CARGOS_TITULADO,
  CODIGOS_ITEMS,
  EDADES,
  FINANCIAMIENTOS,
  GENEROS,
  INSTITUCIONES_PREFERIDAS,
  LIKERT_EMPLEADOR,
  LUGARES_POSGRADO,
  MEDIOS_CONVOCATORIA,
  NIVELES_DEMANDADOS,
  NIVELES_POSGRADO,
  POSIBILIDADES_CONTRATACION,
  REMUNERACIONES,
  RUBROS_EMPLEADOR,
  RUBROS_TITULADO,
  SECTORES,
  SI_NO,
  SITUACIONES_LABORALES,
  TAMANOS_EMPRESA,
  TIEMPOS_PRIMER_EMPLEO,
  TIPOS_ORGANIZACION,
  segmentoDe,
  type Likert,
  type LikertEmpleador
} from '../data/catalogos';
import type { Empleador, Titulado } from '../types';

export type Errores = Record<string, string>;

/** Estado de un formulario: '' significa "sin elegir". */
export type Borrador<T> = { [K in keyof T]: T[K] | '' };

export type BorradorTitulado = Borrador<{
  edad: Titulado['edad'];
  genero: Titulado['genero'];
  anios_vida_profesional: string;
  anios_desempleado: string;
  formacion_complementaria: Titulado['formacion_complementaria'];
  nivel_realizado: NonNullable<Titulado['nivel_realizado']>;
  lugar_realizado: NonNullable<Titulado['lugar_realizado']>;
  financiamiento: NonNullable<Titulado['financiamiento']>;
  interes_posgrado: NonNullable<Titulado['interes_posgrado']>;
  area_interes: NonNullable<Titulado['area_interes']>;
  institucion_preferida: NonNullable<Titulado['institucion_preferida']>;
  situacion_laboral: Titulado['situacion_laboral'];
  sector: NonNullable<Titulado['sector']>;
  rubro: NonNullable<Titulado['rubro']>;
  cargo: NonNullable<Titulado['cargo']>;
  remuneracion: NonNullable<Titulado['remuneracion']>;
  tiempo_primer_empleo: NonNullable<Titulado['tiempo_primer_empleo']>;
  satisfaccion_global: Likert;
  concordancia_formacion: Likert;
  pertinencia_labores: Likert;
  opinion_posgrado_fcyt: Likert;
}> & {
  asignaturas_ventaja: Titulado['asignaturas_ventaja'];
  asignaturas_no_utiles: Titulado['asignaturas_no_utiles'];
};

export const BORRADOR_TITULADO_VACIO: BorradorTitulado = {
  edad: '',
  genero: '',
  anios_vida_profesional: '',
  anios_desempleado: '',
  formacion_complementaria: '',
  nivel_realizado: '',
  lugar_realizado: '',
  financiamiento: '',
  interes_posgrado: '',
  area_interes: '',
  institucion_preferida: '',
  situacion_laboral: '',
  sector: '',
  rubro: '',
  cargo: '',
  remuneracion: '',
  tiempo_primer_empleo: '',
  satisfaccion_global: '',
  concordancia_formacion: '',
  pertinencia_labores: '',
  opinion_posgrado_fcyt: '',
  asignaturas_ventaja: [],
  asignaturas_no_utiles: []
};

const OBLIGATORIO = 'Campo obligatorio';
const def = <T>(v: T | '') => (v === '' ? undefined : v);

/** Años con hasta 2 decimales, entre 0 y 60. */
function leerAnios(texto: string, campo: string, errores: Errores): number | undefined {
  if (texto.trim() === '') {
    errores[campo] = OBLIGATORIO;
    return undefined;
  }
  const n = Number(texto.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 60) {
    errores[campo] = 'Debe ser un número entre 0 y 60';
    return undefined;
  }
  return n;
}

/** Siguiente identificador numérico libre (los de la base son 1, 2, 3…). */
export function siguienteId(existentes: string[]): string {
  const numeros = existentes.map(Number).filter((n) => Number.isInteger(n));
  let id = (numeros.length > 0 ? Math.max(...numeros) : 0) + 1;
  while (existentes.includes(String(id))) id++;
  return String(id);
}

export function validarTitulado(b: BorradorTitulado, id: string): { errores: Errores; registro?: Titulado } {
  const e: Errores = {};
  const requerir = (campo: keyof BorradorTitulado, condicion = true) => {
    if (condicion && b[campo] === '') e[campo] = OBLIGATORIO;
  };

  ['edad', 'genero', 'formacion_complementaria', 'interes_posgrado', 'situacion_laboral', 'satisfaccion_global', 'concordancia_formacion', 'opinion_posgrado_fcyt'].forEach((c) =>
    requerir(c as keyof BorradorTitulado)
  );
  const cursoPosgrado = b.formacion_complementaria === 'Sí';
  ['nivel_realizado', 'lugar_realizado', 'financiamiento'].forEach((c) => requerir(c as keyof BorradorTitulado, cursoPosgrado));
  const interesado = b.interes_posgrado === 'Sí';
  ['area_interes', 'institucion_preferida'].forEach((c) => requerir(c as keyof BorradorTitulado, interesado));
  const trabaja = b.situacion_laboral !== '' && b.situacion_laboral !== 'No trabaja';
  ['sector', 'rubro', 'cargo', 'remuneracion', 'tiempo_primer_empleo', 'pertinencia_labores'].forEach((c) =>
    requerir(c as keyof BorradorTitulado, trabaja)
  );

  const vida = leerAnios(b.anios_vida_profesional, 'anios_vida_profesional', e);
  const desempleo = leerAnios(b.anios_desempleado, 'anios_desempleado', e);
  if (vida !== undefined && desempleo !== undefined && desempleo > vida) {
    e.anios_desempleado = 'No puede superar los años de vida profesional';
  }

  if (Object.keys(e).length > 0 || b.edad === '' || b.genero === '' || b.formacion_complementaria === '' || b.situacion_laboral === '') {
    return { errores: e };
  }

  const registro: Titulado = {
    id,
    edad: b.edad,
    genero: b.genero,
    formacion_complementaria: b.formacion_complementaria,
    nivel_realizado: cursoPosgrado ? def(b.nivel_realizado) : undefined,
    lugar_realizado: cursoPosgrado ? def(b.lugar_realizado) : undefined,
    financiamiento: cursoPosgrado ? def(b.financiamiento) : undefined,
    interes_posgrado: def(b.interes_posgrado),
    area_interes: interesado ? def(b.area_interes) : undefined,
    institucion_preferida: interesado ? def(b.institucion_preferida) : undefined,
    opinion_posgrado_fcyt: def(b.opinion_posgrado_fcyt),
    anios_vida_profesional: vida,
    anios_desempleado: desempleo,
    situacion_laboral: b.situacion_laboral,
    sector: trabaja ? def(b.sector) : undefined,
    rubro: trabaja ? def(b.rubro) : undefined,
    cargo: trabaja ? def(b.cargo) : undefined,
    remuneracion: trabaja ? def(b.remuneracion) : undefined,
    tiempo_primer_empleo: trabaja ? def(b.tiempo_primer_empleo) : undefined,
    pertinencia_labores: trabaja ? def(b.pertinencia_labores) : undefined,
    satisfaccion_global: def(b.satisfaccion_global),
    concordancia_formacion: def(b.concordancia_formacion),
    actividades: [],
    aspectos_utiles: [],
    aspectos_mejorar: [],
    asignaturas_ventaja: b.asignaturas_ventaja,
    asignaturas_no_utiles: b.asignaturas_no_utiles,
    segmento: segmentoDe(vida)
  };
  return { errores: {}, registro };
}

export type BorradorEmpleador = Borrador<{
  organizacion: string;
  tipo: Empleador['tipo'];
  tamano: Empleador['tamano'];
  rubro: NonNullable<Empleador['rubro']>;
  contrato_5_anios: NonNullable<Empleador['contrato_5_anios']>;
  posibilidad_contratacion: NonNullable<Empleador['posibilidad_contratacion']>;
  nivel_demandado: NonNullable<Empleador['nivel_demandado']>;
  medio_convocatoria: NonNullable<Empleador['medio_convocatoria']>;
  tendencias: string;
  habilidades: string;
}> & {
  cargos: Empleador['cargos'];
  items_likert: Partial<Record<string, LikertEmpleador>>;
};

export const BORRADOR_EMPLEADOR_VACIO: BorradorEmpleador = {
  organizacion: '',
  tipo: '',
  tamano: '',
  rubro: '',
  contrato_5_anios: '',
  posibilidad_contratacion: '',
  nivel_demandado: '',
  medio_convocatoria: '',
  tendencias: '',
  habilidades: '',
  cargos: [],
  items_likert: {}
};

export function validarEmpleador(b: BorradorEmpleador, id: string): { errores: Errores; registro?: Empleador } {
  const e: Errores = {};
  if (b.organizacion.trim().length < 2) e.organizacion = 'Escriba el nombre de la organización';
  (['tipo', 'tamano', 'rubro', 'contrato_5_anios', 'posibilidad_contratacion', 'nivel_demandado'] as const).forEach((c) => {
    if (b[c] === '') e[c] = OBLIGATORIO;
  });
  const sinResponder = CODIGOS_ITEMS.filter((c) => b.items_likert[c] === undefined);
  if (sinResponder.length > 0) e.items_likert = `Faltan ${sinResponder.length} de ${CODIGOS_ITEMS.length} afirmaciones (puede elegir «No sabe»)`;

  if (Object.keys(e).length > 0 || b.tipo === '' || b.tamano === '') return { errores: e };
  return {
    errores: {},
    registro: {
      id,
      organizacion: b.organizacion.trim(),
      tipo: b.tipo,
      tamano: b.tamano,
      rubro: def(b.rubro),
      contrato_5_anios: def(b.contrato_5_anios),
      posibilidad_contratacion: def(b.posibilidad_contratacion),
      nivel_demandado: def(b.nivel_demandado),
      medio_convocatoria: def(b.medio_convocatoria),
      cargos: b.cargos,
      tendencias: b.tendencias.trim() || undefined,
      habilidades: b.habilidades.trim() || undefined,
      items_likert: { ...b.items_likert }
    }
  };
}

// ---------------------------------------------------------------------------
// Validación en el servidor
// ---------------------------------------------------------------------------
// Los formularios solo permiten elegir opciones de los catálogos; una petición a la API puede
// traer cualquier cosa. Primero se comprueba que cada campo tenga el tipo y una opción válida,
// y después se aplican las mismas reglas del formulario (validarTitulado / validarEmpleador).

type Regla =
  | { tipo: 'opcion'; catalogo: readonly (string | number)[] }
  | { tipo: 'texto' }
  | { tipo: 'lista'; catalogo: readonly string[] }
  | { tipo: 'itemsLikert' };

const MAX_TEXTO = 2000;
const LIKERT_1_A_4: readonly Likert[] = [1, 2, 3, 4];
const opcion = (catalogo: readonly (string | number)[]): Regla => ({ tipo: 'opcion', catalogo });
const lista = (catalogo: readonly string[]): Regla => ({ tipo: 'lista', catalogo });
const TEXTO: Regla = { tipo: 'texto' };

const REGLAS_TITULADO: Record<keyof BorradorTitulado, Regla> = {
  edad: opcion(EDADES),
  genero: opcion(GENEROS),
  anios_vida_profesional: TEXTO,
  anios_desempleado: TEXTO,
  formacion_complementaria: opcion(SI_NO),
  nivel_realizado: opcion(NIVELES_POSGRADO),
  lugar_realizado: opcion(LUGARES_POSGRADO),
  financiamiento: opcion(FINANCIAMIENTOS),
  interes_posgrado: opcion(SI_NO),
  area_interes: opcion(AREAS_POSGRADO),
  institucion_preferida: opcion(INSTITUCIONES_PREFERIDAS),
  situacion_laboral: opcion(SITUACIONES_LABORALES),
  sector: opcion(SECTORES),
  rubro: opcion(RUBROS_TITULADO),
  cargo: opcion(CARGOS_TITULADO),
  remuneracion: opcion(REMUNERACIONES),
  tiempo_primer_empleo: opcion(TIEMPOS_PRIMER_EMPLEO),
  satisfaccion_global: opcion(LIKERT_1_A_4),
  concordancia_formacion: opcion(LIKERT_1_A_4),
  pertinencia_labores: opcion(LIKERT_1_A_4),
  opinion_posgrado_fcyt: opcion(LIKERT_1_A_4),
  asignaturas_ventaja: lista(ASIGNATURAS_VENTAJA),
  asignaturas_no_utiles: lista(ASIGNATURAS_NO_UTILES)
};

const REGLAS_EMPLEADOR: Record<keyof BorradorEmpleador, Regla> = {
  organizacion: TEXTO,
  tipo: opcion(TIPOS_ORGANIZACION),
  tamano: opcion(TAMANOS_EMPRESA),
  rubro: opcion(RUBROS_EMPLEADOR),
  contrato_5_anios: opcion(SI_NO),
  posibilidad_contratacion: opcion(POSIBILIDADES_CONTRATACION),
  nivel_demandado: opcion(NIVELES_DEMANDADOS),
  medio_convocatoria: opcion(MEDIOS_CONVOCATORIA),
  tendencias: TEXTO,
  habilidades: TEXTO,
  cargos: lista(CARGOS_EMPLEADOR),
  items_likert: { tipo: 'itemsLikert' }
};

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Devuelve el mensaje de error del valor, o undefined si es válido. */
function revisar(regla: Regla, valor: unknown): string | undefined {
  switch (regla.tipo) {
    case 'opcion':
      return valor === '' || regla.catalogo.includes(valor as string | number) ? undefined : 'Opción no válida';
    case 'texto':
      if (typeof valor !== 'string') return 'Debe ser texto';
      return valor.length > MAX_TEXTO ? `No puede superar ${MAX_TEXTO} caracteres` : undefined;
    case 'lista':
      if (!Array.isArray(valor) || valor.some((v) => !regla.catalogo.includes(v as string))) return 'Contiene opciones no válidas';
      return new Set(valor).size === valor.length ? undefined : 'Contiene opciones repetidas';
    case 'itemsLikert':
      if (!esObjeto(valor)) return 'Formato de respuestas no válido';
      return Object.entries(valor).every(([codigo, v]) => CODIGOS_ITEMS.includes(codigo) && LIKERT_EMPLEADOR.includes(v as LikertEmpleador))
        ? undefined
        : 'Contiene afirmaciones o respuestas no válidas';
  }
}

/** Arma un borrador a partir del cuerpo de una petición; un campo ausente queda sin elegir. */
function leerBorrador<B extends object>(entrada: unknown, vacio: B, reglas: Record<keyof B, Regla>): { errores: Errores; borrador?: B } {
  if (!esObjeto(entrada)) return { errores: { cuerpo: 'Se esperaba un objeto JSON' } };
  const errores: Errores = {};
  const borrador = { ...vacio } as Record<string, unknown>;
  for (const [campo, regla] of Object.entries(reglas) as [string, Regla][]) {
    const valor = entrada[campo];
    if (valor === undefined) continue;
    const error = revisar(regla, valor);
    if (error) errores[campo] = error;
    else borrador[campo] = valor;
  }
  return Object.keys(errores).length > 0 ? { errores } : { errores, borrador: borrador as unknown as B };
}

/** Valida el cuerpo de POST /api/titulados. El id lo asigna la base de datos. */
export function validarTituladoRecibido(entrada: unknown): { errores: Errores; registro?: Omit<Titulado, 'id'> } {
  const { errores, borrador } = leerBorrador(entrada, BORRADOR_TITULADO_VACIO, REGLAS_TITULADO);
  return borrador ? validarTitulado(borrador, '') : { errores };
}

/** Valida el cuerpo de POST /api/empleadores. El id lo asigna la base de datos. */
export function validarEmpleadorRecibido(entrada: unknown): { errores: Errores; registro?: Omit<Empleador, 'id'> } {
  const { errores, borrador } = leerBorrador(entrada, BORRADOR_EMPLEADOR_VACIO, REGLAS_EMPLEADOR);
  return borrador ? validarEmpleador(borrador, '') : { errores };
}
