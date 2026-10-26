/**
 * Importación de la base de encuestas (Excel .xlsx o CSV) al modelo de la aplicación.
 *
 * Cada columna tiene una especificación explícita (nombre exacto, tipo y catálogo válido).
 * No se adivina ni se inventa ningún dato: un valor que no se reconoce queda vacío y se
 * informa como advertencia con su hoja, fila y columna.
 */

import type * as XLSX from 'xlsx';
import {
  ACTIVIDADES,
  ANTIGUEDADES,
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
  segmentoDe
} from '../data/catalogos';
import type { Empleador, ItemEmpleador, Titulado } from '../types';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type Severidad = 'error' | 'advertencia';

export interface ProblemaImportacion {
  hoja: string;
  /** Número de fila tal como se ve en Excel (el encabezado es la fila 1). */
  fila: number;
  columna?: string;
  valor?: string;
  mensaje: string;
  severidad: Severidad;
}

export interface ResultadoImportacion {
  titulados?: Titulado[];
  empleadores?: Empleador[];
  items?: ItemEmpleador[];
  problemas: ProblemaImportacion[];
}

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

/**
 * Clave de comparación: sin tildes, en minúsculas, sin puntos y con cualquier otro
 * signo convertido en espacio. Así "Bs. 2.500" y "Bs. 2500", o "Computo" y "Cómputo",
 * se reconocen como el mismo valor.
 */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function aTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'boolean') return valor ? 'true' : 'false';
  return String(valor).trim();
}

function crearDiccionario(catalogo: readonly string[], alias: Record<string, string> = {}): Map<string, string> {
  const dic = new Map<string, string>();
  for (const valor of catalogo) dic.set(normalizarTexto(valor), valor);
  for (const [variante, canonico] of Object.entries(alias)) dic.set(normalizarTexto(variante), canonico);
  return dic;
}

const DIC_SI_NO = crearDiccionario(SI_NO, { si: 'Sí', true: 'Sí', '1': 'Sí', false: 'No', '0': 'No' });

const DIC_LIKERT_TITULADOS = new Map<string, number>([
  ...LIKERT_TITULADOS.map((etiqueta, i) => [normalizarTexto(etiqueta), i + 1] as [string, number]),
  ['1', 1],
  ['2', 2],
  ['3', 3],
  ['4', 4]
]);

const DIC_LIKERT_EMPLEADOR = crearDiccionario(LIKERT_EMPLEADOR, {
  'Totalmente desacuerdo': 'Totalmente en desacuerdo'
});

// ---------------------------------------------------------------------------
// Especificación de columnas
// ---------------------------------------------------------------------------

type TipoColumna =
  | { tipo: 'id' }
  | { tipo: 'texto' }
  | { tipo: 'siNo' }
  | { tipo: 'likert' }
  | { tipo: 'likertEmpleador' }
  | { tipo: 'numero'; min: number; max: number }
  | { tipo: 'categoria'; dic: Map<string, string> }
  | { tipo: 'lista'; dic: Map<string, string> };

export interface Columna {
  nombre: string;
  def: TipoColumna;
  obligatoria?: boolean;
}

const categoria = (catalogo: readonly string[], alias?: Record<string, string>): TipoColumna => ({
  tipo: 'categoria',
  dic: crearDiccionario(catalogo, alias)
});
const lista = (catalogo: readonly string[]): TipoColumna => ({ tipo: 'lista', dic: crearDiccionario(catalogo) });

/** Columnas de la hoja Titulados, en el orden de la base real. */
export const COLUMNAS_TITULADOS: Columna[] = [
  { nombre: 'id', def: { tipo: 'id' } },
  { nombre: 'edad', def: categoria(EDADES), obligatoria: true },
  { nombre: 'genero', def: categoria(GENEROS), obligatoria: true },
  { nombre: 'formacion_complementaria', def: { tipo: 'siNo' }, obligatoria: true },
  { nombre: 'nivel_realizado', def: categoria(NIVELES_POSGRADO) },
  { nombre: 'lugar_realizado', def: categoria(LUGARES_POSGRADO) },
  { nombre: 'financiamiento', def: categoria(FINANCIAMIENTOS) },
  { nombre: 'programa', def: { tipo: 'texto' } },
  { nombre: 'interes_posgrado', def: { tipo: 'siNo' } },
  { nombre: 'area_interes', def: categoria(AREAS_POSGRADO) },
  { nombre: 'institucion_preferida', def: categoria(INSTITUCIONES_PREFERIDAS) },
  { nombre: 'opinion_posgrado_fcyt', def: { tipo: 'likert' } },
  { nombre: 'anios_vida_profesional', def: { tipo: 'numero', min: 0, max: 60 } },
  { nombre: 'anios_desempleado', def: { tipo: 'numero', min: 0, max: 60 } },
  { nombre: 'situacion_laboral', def: categoria(SITUACIONES_LABORALES), obligatoria: true },
  { nombre: 'empresa', def: { tipo: 'texto' } },
  { nombre: 'rubro', def: categoria(RUBROS_TITULADO) },
  { nombre: 'sector', def: categoria(SECTORES) },
  { nombre: 'departamento', def: categoria(DEPARTAMENTOS) },
  { nombre: 'actividades', def: lista(ACTIVIDADES) },
  { nombre: 'cargo', def: categoria(CARGOS_TITULADO) },
  { nombre: 'pertinencia_labores', def: { tipo: 'likert' } },
  { nombre: 'antiguedad_trabajo', def: categoria(ANTIGUEDADES) },
  { nombre: 'medio_obtencion', def: categoria(MEDIOS_OBTENCION) },
  { nombre: 'remuneracion', def: categoria(REMUNERACIONES) },
  { nombre: 'origen_emprendimiento', def: categoria(ORIGENES_EMPRENDIMIENTO) },
  { nombre: 'entregable_negocio', def: categoria(ENTREGABLES_NEGOCIO) },
  { nombre: 'financiamiento_negocio', def: categoria(FINANCIAMIENTOS_NEGOCIO) },
  { nombre: 'satisfaccion_negocio', def: categoria(SATISFACCIONES_NEGOCIO) },
  { nombre: 'importancia_formacion_negocio', def: categoria(IMPORTANCIAS_FORMACION) },
  { nombre: 'primer_empleo', def: { tipo: 'siNo' } },
  { nombre: 'razon_no_trabaja', def: categoria(RAZONES_NO_TRABAJA) },
  { nombre: 'trabajo_previo_sistemas', def: { tipo: 'siNo' } },
  { nombre: 'tiempo_primer_empleo', def: categoria(TIEMPOS_PRIMER_EMPLEO) },
  { nombre: 'numero_empleos', def: categoria(NUMERO_EMPLEOS) },
  { nombre: 'satisfaccion_global', def: { tipo: 'likert' } },
  { nombre: 'concordancia_formacion', def: { tipo: 'likert' } },
  { nombre: 'aspectos_utiles', def: lista(ASPECTOS_UTILES) },
  { nombre: 'aspectos_mejorar', def: lista(ASPECTOS_MEJORAR) },
  { nombre: 'asignaturas_ventaja', def: lista(ASIGNATURAS_VENTAJA) },
  { nombre: 'asignaturas_no_utiles', def: lista(ASIGNATURAS_NO_UTILES) },
  { nombre: 'red_contactos', def: { tipo: 'siNo' } }
];

/** Columnas de la hoja Empleadores, en el orden de la base real. */
export const COLUMNAS_EMPLEADORES: Columna[] = [
  { nombre: 'id', def: { tipo: 'id' } },
  { nombre: 'organizacion', def: { tipo: 'texto' }, obligatoria: true },
  { nombre: 'tipo', def: categoria(TIPOS_ORGANIZACION), obligatoria: true },
  { nombre: 'tamano', def: categoria(TAMANOS_EMPRESA), obligatoria: true },
  { nombre: 'rubro', def: categoria(RUBROS_EMPLEADOR) },
  { nombre: 'contrato_5_anios', def: { tipo: 'siNo' } },
  { nombre: 'posibilidad_contratacion', def: categoria(POSIBILIDADES_CONTRATACION) },
  { nombre: 'nivel_demandado', def: categoria(NIVELES_DEMANDADOS) },
  { nombre: 'medio_convocatoria', def: categoria(MEDIOS_CONVOCATORIA) },
  { nombre: 'cargos', def: lista(CARGOS_EMPLEADOR) },
  { nombre: 'tendencias', def: { tipo: 'texto' } },
  { nombre: 'habilidades', def: { tipo: 'texto' } },
  ...CODIGOS_ITEMS.map((codigo): Columna => ({ nombre: codigo, def: { tipo: 'likertEmpleador' } }))
];

const COLUMNAS_LISTA = new Set(
  [...COLUMNAS_TITULADOS, ...COLUMNAS_EMPLEADORES].filter((c) => c.def.tipo === 'lista').map((c) => c.nombre)
);

// ---------------------------------------------------------------------------
// Conversión de una celda
// ---------------------------------------------------------------------------

type Conversion = { ok: true; valor: unknown } | { ok: false; mensaje: string };

function convertirCelda(def: TipoColumna, crudo: string): Conversion {
  switch (def.tipo) {
    case 'id':
    case 'texto':
      return { ok: true, valor: crudo };
    case 'siNo': {
      const v = DIC_SI_NO.get(normalizarTexto(crudo));
      return v ? { ok: true, valor: v } : { ok: false, mensaje: 'Se esperaba Sí o No' };
    }
    case 'likert': {
      const v = DIC_LIKERT_TITULADOS.get(normalizarTexto(crudo));
      return v ? { ok: true, valor: v } : { ok: false, mensaje: 'Valor Likert no reconocido' };
    }
    case 'likertEmpleador': {
      const v = DIC_LIKERT_EMPLEADOR.get(normalizarTexto(crudo));
      return v ? { ok: true, valor: v } : { ok: false, mensaje: 'Valor Likert no reconocido' };
    }
    case 'numero': {
      const n = Number(crudo.replace(',', '.'));
      if (!Number.isFinite(n)) return { ok: false, mensaje: 'No es un número' };
      if (n < def.min || n > def.max) return { ok: false, mensaje: `Fuera de rango (${def.min} a ${def.max})` };
      return { ok: true, valor: n };
    }
    case 'categoria': {
      const v = def.dic.get(normalizarTexto(crudo));
      return v ? { ok: true, valor: v } : { ok: false, mensaje: 'Categoría no reconocida' };
    }
    case 'lista': {
      const elementos: string[] = [];
      const desconocidos: string[] = [];
      for (const parte of crudo.split(';')) {
        const limpio = parte.trim();
        if (!limpio) continue;
        const v = def.dic.get(normalizarTexto(limpio));
        if (v) {
          if (!elementos.includes(v)) elementos.push(v);
        } else {
          desconocidos.push(limpio);
        }
      }
      return desconocidos.length > 0
        ? { ok: false, mensaje: `Opciones no reconocidas: ${desconocidos.join(' | ')}` }
        : { ok: true, valor: elementos };
    }
  }
}

// ---------------------------------------------------------------------------
// Conversión de una hoja
// ---------------------------------------------------------------------------

/** Convierte el encabezado de una columna en su nombre de especificación. */
function claveEncabezado(encabezado: unknown): string {
  return normalizarTexto(aTexto(encabezado)).replace(/ /g, '_');
}

interface RegistroCrudo {
  fila: number;
  datos: Record<string, unknown>;
}

function convertirHoja(
  hoja: string,
  filas: unknown[][],
  columnas: Columna[],
  problemas: ProblemaImportacion[]
): RegistroCrudo[] | undefined {
  if (filas.length === 0) {
    problemas.push({ hoja, fila: 1, mensaje: 'La hoja está vacía', severidad: 'error' });
    return undefined;
  }

  const indice = new Map<string, number>();
  filas[0].forEach((enc, i) => indice.set(claveEncabezado(enc), i));

  for (const col of columnas) {
    if (!indice.has(col.nombre)) {
      problemas.push({
        hoja,
        fila: 1,
        columna: col.nombre,
        mensaje: col.obligatoria ? 'Falta una columna obligatoria' : 'Falta la columna; se tratará como sin respuesta',
        severidad: col.obligatoria ? 'error' : 'advertencia'
      });
    }
  }
  if (columnas.some((c) => c.obligatoria && !indice.has(c.nombre))) return undefined;

  const registros: RegistroCrudo[] = [];
  const idsVistos = new Set<string>();

  for (let r = 1; r < filas.length; r++) {
    const fila = r + 1;
    const celdas = filas[r];
    const registro: Record<string, unknown> = {};
    let descartar = false;

    for (const col of columnas) {
      const i = indice.get(col.nombre);
      const crudo = i === undefined ? '' : aTexto(celdas[i]);

      if (crudo === '') {
        if (col.obligatoria) {
          problemas.push({ hoja, fila, columna: col.nombre, mensaje: 'Campo obligatorio vacío; fila descartada', severidad: 'error' });
          descartar = true;
        }
        if (COLUMNAS_LISTA.has(col.nombre)) registro[col.nombre] = [];
        continue;
      }

      const conv = convertirCelda(col.def, crudo);
      if (conv.ok) {
        registro[col.nombre] = conv.valor;
      } else if (col.obligatoria) {
        problemas.push({ hoja, fila, columna: col.nombre, valor: crudo, mensaje: `${conv.mensaje}; fila descartada`, severidad: 'error' });
        descartar = true;
      } else {
        problemas.push({ hoja, fila, columna: col.nombre, valor: crudo, mensaje: `${conv.mensaje}; se deja sin respuesta`, severidad: 'advertencia' });
        if (COLUMNAS_LISTA.has(col.nombre)) registro[col.nombre] = [];
      }
    }

    if (descartar) continue;

    // Identificador único: se respeta el de la base y se corrigen vacíos o duplicados.
    let id = typeof registro.id === 'string' && registro.id !== '' ? registro.id : `fila-${fila}`;
    if (idsVistos.has(id)) {
      problemas.push({ hoja, fila, columna: 'id', valor: id, mensaje: 'Identificador duplicado; se renombró', severidad: 'advertencia' });
      id = `${id}-fila-${fila}`;
    }
    idsVistos.add(id);
    registro.id = id;

    registros.push({ fila, datos: registro });
  }

  return registros;
}

function aTitulados(registros: RegistroCrudo[], problemas: ProblemaImportacion[]): Titulado[] {
  return registros.map(({ fila, datos }) => {
    const t = datos as unknown as Titulado;
    // Regla de limpieza del informe: el desempleo no puede superar la vida profesional.
    if (
      t.anios_desempleado !== undefined &&
      t.anios_vida_profesional !== undefined &&
      t.anios_desempleado > t.anios_vida_profesional
    ) {
      problemas.push({
        hoja: 'Titulados',
        fila,
        columna: 'anios_desempleado',
        valor: String(t.anios_desempleado),
        mensaje: 'Supera los años de vida profesional; se deja sin respuesta',
        severidad: 'advertencia'
      });
      t.anios_desempleado = undefined;
    }
    t.segmento = segmentoDe(t.anios_vida_profesional);
    return t;
  });
}

function aEmpleadores(registros: RegistroCrudo[]): Empleador[] {
  return registros.map(({ datos: registro }) => {
    const items_likert: Empleador['items_likert'] = {};
    for (const codigo of CODIGOS_ITEMS) {
      if (registro[codigo] !== undefined) items_likert[codigo] = registro[codigo] as Empleador['items_likert'][string];
      delete registro[codigo];
    }
    return { ...(registro as unknown as Omit<Empleador, 'items_likert'>), items_likert };
  });
}

function aItems(filas: unknown[][], problemas: ProblemaImportacion[]): ItemEmpleador[] {
  const items: ItemEmpleador[] = [];
  const enc = (filas[0] ?? []).map(claveEncabezado);
  const iCodigo = enc.indexOf('codigo');
  const iTexto = enc.indexOf('afirmacion');
  if (iCodigo === -1 || iTexto === -1) {
    problemas.push({ hoja: 'Items_empleadores', fila: 1, mensaje: 'Faltan las columnas codigo / afirmacion', severidad: 'advertencia' });
    return items;
  }
  for (let r = 1; r < filas.length; r++) {
    const codigo = aTexto(filas[r][iCodigo]);
    const afirmacion = aTexto(filas[r][iTexto]);
    if (codigo && afirmacion) items.push({ codigo, afirmacion });
  }
  return items;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

type ModuloXLSX = typeof XLSX;
let moduloXLSX: Promise<ModuloXLSX> | undefined;

/**
 * Carga SheetJS bajo demanda (una sola vez). Va en un chunk aparte para que la
 * interfaz aparezca antes de descargar la librería.
 */
export function obtenerXLSX(): Promise<ModuloXLSX> {
  moduloXLSX ??= import('xlsx');
  return moduloXLSX;
}

/** Lee un archivo .xlsx o .csv. Los CSV se decodifican como UTF-8 (o Windows-1252 si no lo son). */
function leerLibro(xlsx: ModuloXLSX, datos: ArrayBuffer, nombreArchivo: string): XLSX.WorkBook {
  if (/\.(csv|txt)$/i.test(nombreArchivo)) {
    let texto: string;
    try {
      texto = new TextDecoder('utf-8', { fatal: true }).decode(datos);
    } catch {
      texto = new TextDecoder('windows-1252').decode(datos);
    }
    if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1); // quita el BOM de UTF-8
    // Excel en español guarda los CSV con ";" como separador.
    const primeraLinea = texto.split(/\r?\n/, 1)[0] ?? '';
    const separador = (primeraLinea.match(/;/g) ?? []).length > (primeraLinea.match(/,/g) ?? []).length ? ';' : ',';
    return xlsx.read(texto, { type: 'string', raw: true, FS: separador });
  }
  return xlsx.read(datos, { type: 'array' });
}

function filasDe(xlsx: ModuloXLSX, ws: XLSX.WorkSheet): unknown[][] {
  return xlsx.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: true, blankrows: false });
}

/**
 * Convierte un libro en registros. Busca las hojas por nombre (Titulados, Empleadores,
 * Items_empleadores); si el libro tiene una sola hoja (caso CSV), la identifica por sus columnas.
 */
function importarLibro(xlsx: ModuloXLSX, wb: XLSX.WorkBook): ResultadoImportacion {
  const problemas: ProblemaImportacion[] = [];
  const resultado: ResultadoImportacion = { problemas };
  const filas = (hoja: string) => filasDe(xlsx, wb.Sheets[hoja]);

  const porNombre = new Map(wb.SheetNames.map((n) => [claveEncabezado(n), n]));
  let hojaTit = porNombre.get('titulados');
  let hojaEmp = porNombre.get('empleadores');
  const hojaItems = porNombre.get('items_empleadores');

  if (!hojaTit && !hojaEmp && wb.SheetNames.length === 1) {
    const unica = wb.SheetNames[0];
    const enc = new Set((filas(unica)[0] ?? []).map(claveEncabezado));
    if (enc.has('situacion_laboral')) hojaTit = unica;
    else if (enc.has('organizacion') && enc.has('item_01')) hojaEmp = unica;
  }

  if (!hojaTit && !hojaEmp) {
    problemas.push({
      hoja: wb.SheetNames.join(', ') || '(sin hojas)',
      fila: 1,
      mensaje: 'No se encontró una hoja de Titulados ni de Empleadores (revise los nombres de hojas o de columnas)',
      severidad: 'error'
    });
    return resultado;
  }

  if (hojaTit) {
    const registros = convertirHoja('Titulados', filas(hojaTit), COLUMNAS_TITULADOS, problemas);
    if (registros) resultado.titulados = aTitulados(registros, problemas);
  }
  if (hojaEmp) {
    const registros = convertirHoja('Empleadores', filas(hojaEmp), COLUMNAS_EMPLEADORES, problemas);
    if (registros) resultado.empleadores = aEmpleadores(registros);
  }
  if (hojaItems) {
    resultado.items = aItems(filas(hojaItems), problemas);
  }

  return resultado;
}

/** Importa un archivo .xlsx (libro completo) o .csv (una hoja). */
export async function importarArchivo(datos: ArrayBuffer, nombreArchivo: string): Promise<ResultadoImportacion> {
  const xlsx = await obtenerXLSX();
  return importarLibro(xlsx, leerLibro(xlsx, datos, nombreArchivo));
}

/** Nombre de la base real incluida en la aplicación (carpeta public/data). */
export const NOMBRE_BASE_REAL = 'Base_Limpia_Titulados_Empleadores.xlsx';

/**
 * Descarga e importa la base real incluida en la aplicación. La ruta se arma aquí y no al
 * cargar el módulo, porque import.meta.env solo existe en Vite (el seed lo usa desde Node).
 */
export async function cargarBaseReal(): Promise<ResultadoImportacion> {
  const respuesta = await fetch(`${import.meta.env.BASE_URL}data/${NOMBRE_BASE_REAL}`);
  if (!respuesta.ok) {
    throw new Error(`No se pudo descargar ${NOMBRE_BASE_REAL} (HTTP ${respuesta.status})`);
  }
  return importarArchivo(await respuesta.arrayBuffer(), NOMBRE_BASE_REAL);
}
