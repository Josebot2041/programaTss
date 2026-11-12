import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { importarArchivo, type ResultadoImportacion } from './importador';

const RUTA_EXCEL = resolve(import.meta.dirname, '../../public/data/Base_Limpia_Titulados_Empleadores.xlsx');

function aArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function importarExcelReal(): Promise<ResultadoImportacion> {
  return importarArchivo(aArrayBuffer(readFileSync(RUTA_EXCEL)), 'Base_Limpia_Titulados_Empleadores.xlsx');
}

function importarTexto(texto: string, nombre: string): Promise<ResultadoImportacion> {
  return importarArchivo(aArrayBuffer(Buffer.from(texto, 'utf-8')), nombre);
}

const r = await importarExcelReal();

function contar<T>(valores: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const v of valores) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

describe('Importación de la base real (Base_Limpia_Titulados_Empleadores.xlsx)', () => {
  const titulados = r.titulados ?? [];
  const empleadores = r.empleadores ?? [];

  it('lee las tres hojas completas y sin problemas', () => {
    expect(r.problemas).toEqual([]);
    expect(titulados).toHaveLength(184);
    expect(empleadores).toHaveLength(78);
    expect(r.items).toHaveLength(18);
  });

  it('respeta los valores vacíos en lugar de inventarlos', () => {
    expect(titulados.filter((t) => t.anios_vida_profesional === undefined)).toHaveLength(3);
    expect(titulados.filter((t) => t.anios_desempleado === undefined)).toHaveLength(4);
    expect(titulados.filter((t) => t.rubro === undefined)).toHaveLength(45);
    expect(titulados.filter((t) => t.satisfaccion_global === undefined)).toHaveLength(2);
  });

  it('normaliza categorías y escalas Likert', () => {
    expect(contar(titulados.map((t) => t.genero))).toEqual(new Map([['Hombre', 147], ['Mujer', 37]]));
    expect(contar(titulados.map((t) => t.sector)).get('Público')).toBe(33);
    expect(contar(titulados.map((t) => t.remuneracion)).get('Menor a Bs. 2.500')).toBe(5);
    expect(contar(titulados.map((t) => t.medio_obtencion)).get('Postulación competitiva (convocatorias públicas y privadas)')).toBe(55);
    // pertinencia_labores debe leerse de su propia columna (no de importancia_formacion_negocio)
    expect(contar(titulados.map((t) => t.pertinencia_labores))).toEqual(
      new Map([[undefined, 45], [4, 55], [3, 71], [2, 7], [1, 6]])
    );
    expect(contar(empleadores.map((e) => e.tipo))).toEqual(new Map([['Privado', 62], ['Público', 16]]));
    expect(contar(empleadores.map((e) => e.items_likert.item_01))).toEqual(
      new Map([
        ['Totalmente de acuerdo', 37],
        ['Parcialmente de acuerdo', 29],
        ['Totalmente en desacuerdo', 7],
        ['No sabe', 5]
      ])
    );
  });

  it('separa las respuestas de selección múltiple', () => {
    const ventaja = contar(titulados.flatMap((t) => t.asignaturas_ventaja));
    expect(ventaja.get('Base de Datos')).toBe(172);
    expect(ventaja.get('T.I.S.')).toBe(136);
    expect(contar(empleadores.flatMap((e) => e.cargos)).get('Técnico')).toBe(58);
  });

  it('calcula el segmento junior / consolidado', () => {
    const seg = contar(titulados.map((t) => t.segmento));
    expect(seg.get('Junior (< 5 años)')).toBe(71);
    expect(seg.get('Consolidado (≥ 5 años)')).toBe(110);
    expect(seg.get(undefined)).toBe(3);
  });
});

describe('Importación de CSV', () => {
  it('reimporta un CSV con ";" exportado de la hoja Titulados y obtiene los mismos registros', async () => {
    const wb = XLSX.read(readFileSync(RUTA_EXCEL), { type: 'buffer' });
    const csv = String.fromCharCode(0xfeff) + XLSX.utils.sheet_to_csv(wb.Sheets['Titulados'], { FS: ';' });
    const desdeCsv = await importarTexto(csv, 'titulados.csv');
    expect(desdeCsv.problemas).toEqual([]);
    expect(desdeCsv.titulados).toEqual(r.titulados);
  });

  it('informa los valores no reconocidos en lugar de inventar uno', async () => {
    const csv = [
      'id;edad;genero;formacion_complementaria;situacion_laboral;sector;anios_vida_profesional;anios_desempleado',
      '1;23 - 26 años;Mujer;SI;No trabaja;Mixto;2;5',
      '2;99 años;Hombre;NO;No trabaja;;;'
    ].join('\n');
    const prueba = await importarTexto(csv, 'prueba.csv');
    expect(prueba.titulados).toHaveLength(1);
    expect(prueba.titulados?.[0].sector).toBeUndefined();
    expect(prueba.titulados?.[0].anios_desempleado).toBeUndefined();
    expect(prueba.problemas.map((p) => [p.fila, p.columna, p.severidad])).toEqual(
      expect.arrayContaining([
        [2, 'sector', 'advertencia'],
        [2, 'anios_desempleado', 'advertencia'],
        [3, 'edad', 'error']
      ])
    );
  });
});

describe('Base real de public/data (importarBaseReal)', async () => {
  const { leerBaseRealLocal } = await import('./baseRealLocal');
  const { importarBaseReal } = await import('./importador');

  it('lee titulados, empleadores y afirmaciones del .xlsx generado con cargar-encuestas', async () => {
    const base = await leerBaseRealLocal();
    expect(base.fuentes).toEqual({
      titulados: 'Base_Limpia_Titulados_Empleadores.xlsx',
      empleadores: 'Base_Limpia_Titulados_Empleadores.xlsx',
      items: 'Base_Limpia_Titulados_Empleadores.xlsx'
    });
    expect(base.problemas).toEqual([]);
    expect(base.titulados).toEqual(r.titulados);
    expect(base.empleadores).toEqual(r.empleadores);
    expect(base.items).toEqual(r.items);
  });

  it('un CSV con solo titulados tiene prioridad y se completa con el .xlsx; sin archivos avisa', async () => {
    const wb = XLSX.read(readFileSync(RUTA_EXCEL), { type: 'buffer' });
    const filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Titulados'], { header: 1 }).slice(0, 4);
    const csv = Buffer.from(filas.map((f) => f.join(';')).join('\n'), 'utf-8');
    const base = await importarBaseReal(async (nombre) => aArrayBuffer(nombre.endsWith('.csv') ? csv : readFileSync(RUTA_EXCEL)));
    expect(base.fuentes).toEqual({
      titulados: 'Base_Limpia_Titulados_Empleadores.csv',
      empleadores: 'Base_Limpia_Titulados_Empleadores.xlsx',
      items: 'Base_Limpia_Titulados_Empleadores.xlsx'
    });
    expect(base.titulados).toHaveLength(3);
    expect(base.empleadores).toEqual(r.empleadores);
    await expect(importarBaseReal(async () => undefined)).rejects.toThrow(/No se encontró/);
  });
});
