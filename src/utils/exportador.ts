/**
 * Exportación de la base activa a CSV (Excel en español: BOM UTF-8 y ";") y a .xlsx.
 * Usa las mismas columnas y etiquetas que el importador, así un archivo exportado se reimporta igual.
 */

import { LIKERT_TITULADOS } from '../data/catalogos';
import type { Empleador, Titulado } from '../types';
import { PRUEBAS_INDEPENDENCIA } from './analisis';
import { pruebaIndependencia } from './estadistica';
import { calcularResumen, generarHallazgos } from './hallazgos';
import { COLUMNAS_EMPLEADORES, COLUMNAS_TITULADOS, obtenerXLSX, type Columna } from './importador';

type Celda = string | number;

/** Valor de una celda tal como lo escribe la base real. */
function celda(columna: Columna, valor: unknown): Celda {
  if (valor === undefined || valor === null) return '';
  if (Array.isArray(valor)) return valor.join('; ');
  if (columna.def.tipo === 'likert' && typeof valor === 'number') return LIKERT_TITULADOS[valor - 1] ?? '';
  if (typeof valor === 'number') return valor;
  return String(valor);
}

export function filasTitulados(titulados: Titulado[]): Celda[][] {
  return [
    COLUMNAS_TITULADOS.map((c) => c.nombre),
    ...titulados.map((t) => COLUMNAS_TITULADOS.map((c) => celda(c, (t as unknown as Record<string, unknown>)[c.nombre])))
  ];
}

export function filasEmpleadores(empleadores: Empleador[]): Celda[][] {
  return [
    COLUMNAS_EMPLEADORES.map((c) => c.nombre),
    ...empleadores.map((e) =>
      COLUMNAS_EMPLEADORES.map((c) =>
        celda(c, c.nombre.startsWith('item_') ? e.items_likert[c.nombre] : (e as unknown as Record<string, unknown>)[c.nombre])
      )
    )
  ];
}

/** Indicadores calculados (una fila por resultado) para la hoja Resultados. */
export function filasResultados(titulados: Titulado[], empleadores: Empleador[]): Celda[][] {
  const r = calcularResumen(titulados, empleadores);
  const redondeo = (v: number | null | undefined, d = 4) => (v === null || v === undefined || !Number.isFinite(v) ? '' : Number(v.toFixed(d)));
  const filas: Celda[][] = [['Sección', 'Indicador', 'Valor', 'Base']];
  const agregar = (seccion: string, indicador: string, valor: Celda, base: Celda = '') => filas.push([seccion, indicador, valor, base]);

  const g = r.vida.general;
  agregar('HU1', 'Años de vida profesional: media', redondeo(g?.media), g?.n ?? 0);
  agregar('HU1', 'Años de vida profesional: mediana', redondeo(g?.mediana), g?.n ?? 0);
  agregar('HU1', 'Años de vida profesional: desviación estándar', redondeo(g?.desviacion), g?.n ?? 0);
  agregar('HU1', 'Junior (< 5 años)', r.vida.junior?.n ?? 0, g?.n ?? 0);
  agregar('HU1', 'Consolidado (≥ 5 años)', r.vida.consolidado?.n ?? 0, g?.n ?? 0);
  r.posgrado.areas.filas.forEach((f) => agregar('HU2', `Área de interés: ${f.categoria} (%)`, redondeo(f.porcentaje, 1), r.posgrado.areas.total));
  agregar('HU2', 'Dos áreas principales (%)', redondeo(r.posgrado.concentracionAreas.porcentaje, 1), r.posgrado.areas.total);
  r.posgrado.niveles.filas.forEach((f) => agregar('HU2', `Nivel cursado: ${f.categoria} (%)`, redondeo(f.porcentaje, 1), r.posgrado.niveles.total));

  for (const def of PRUEBAS_INDEPENDENCIA) {
    const p = pruebaIndependencia(def.construir(titulados));
    if (!p) continue;
    agregar('HU3', `${def.relacion}: método oficial`, p.metodoOficial === 'fisher' ? 'Fisher' : p.metodoOficial === 'yates' ? 'Yates' : 'Chi-cuadrado');
    agregar('HU3', `${def.relacion}: χ² sin corrección`, redondeo(p.sinCorreccion.estadistico, 3), p.tabla.total);
    if (p.yates) agregar('HU3', `${def.relacion}: χ² Yates`, redondeo(p.yates.estadistico, 3), p.tabla.total);
    if (p.fisher) agregar('HU3', `${def.relacion}: p Fisher`, redondeo(p.fisher.pValor), p.tabla.total);
    agregar('HU3', `${def.relacion}: p oficial`, redondeo(p.pValorOficial), p.tabla.total);
    agregar('HU3', `${def.relacion}: decisión`, p.rechazaH0 ? 'Se rechaza H0' : 'No se rechaza H0');
  }

  r.valoracion.forEach((v) => {
    agregar('HU4', `${v.texto}: media`, redondeo(v.estadisticos?.media, 2), v.estadisticos?.n ?? 0);
    agregar('HU4', `${v.texto}: desviación estándar`, redondeo(v.estadisticos?.desviacion, 2), v.estadisticos?.n ?? 0);
  });
  r.dimensiones.forEach((d) => agregar('Empleadores', `Índice: ${d.dimension}`, redondeo(d.indice, 1), empleadores.length));
  r.emp.tecnologias.temas.forEach((t) => agregar('Empleadores', `Tecnología: ${t.categoria} (%)`, redondeo(t.porcentaje, 1), r.emp.tecnologias.validas));
  generarHallazgos(r).forEach((h) => agregar('Hallazgos', `${h.numero}. ${h.hallazgo}`, h.evidencia));
  return filas;
}

/** CSV para Excel en español: BOM UTF-8, separador ";" y comillas cuando hace falta. */
export function aCSV(filas: Celda[][]): string {
  const escapar = (v: Celda) => {
    const texto = typeof v === 'number' ? String(v) : v;
    return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  return String.fromCharCode(0xfeff) + filas.map((f) => f.map(escapar).join(';')).join('\r\n');
}

/** Libro .xlsx con las hojas Titulados, Empleadores y Resultados. */
export async function aXlsx(titulados: Titulado[], empleadores: Empleador[]): Promise<ArrayBuffer> {
  const xlsx = await obtenerXLSX();
  const libro = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(libro, xlsx.utils.aoa_to_sheet(filasTitulados(titulados)), 'Titulados');
  xlsx.utils.book_append_sheet(libro, xlsx.utils.aoa_to_sheet(filasEmpleadores(empleadores)), 'Empleadores');
  xlsx.utils.book_append_sheet(libro, xlsx.utils.aoa_to_sheet(filasResultados(titulados, empleadores)), 'Resultados');
  return xlsx.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

/** Descarga un contenido como archivo en el navegador. */
export function descargar(contenido: BlobPart, nombre: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}
