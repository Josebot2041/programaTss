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
    expect(titulados).toHaveLength(148);
    expect(empleadores).toHaveLength(51);
    expect(r.items).toHaveLength(18);
  });

  it('respeta los valores vacíos en lugar de inventarlos', () => {
    expect(titulados.filter((t) => t.anios_vida_profesional === undefined)).toHaveLength(3);
    expect(titulados.filter((t) => t.anios_desempleado === undefined)).toHaveLength(5);
    expect(titulados.filter((t) => t.rubro === undefined)).toHaveLength(40);
    expect(titulados.filter((t) => t.satisfaccion_global === undefined)).toHaveLength(1);
  });

  it('normaliza categorías y escalas Likert', () => {
    expect(contar(titulados.map((t) => t.genero))).toEqual(new Map([['Hombre', 115], ['Mujer', 33]]));
    expect(contar(titulados.map((t) => t.sector)).get('Público')).toBe(21);
    expect(contar(titulados.map((t) => t.remuneracion)).get('Menor a Bs. 2.500')).toBe(5);
    expect(contar(titulados.map((t) => t.medio_obtencion)).get('Postulación competitiva (convocatorias públicas y privadas)')).toBe(44);
    // pertinencia_labores debe leerse de su propia columna (no de importancia_formacion_negocio)
    expect(contar(titulados.map((t) => t.pertinencia_labores))).toEqual(
      new Map([[undefined, 40], [4, 42], [3, 56], [2, 5], [1, 5]])
    );
    expect(contar(empleadores.map((e) => e.tipo))).toEqual(new Map([['Privado', 39], ['Público', 12]]));
    expect(contar(empleadores.map((e) => e.items_likert.item_01))).toEqual(
      new Map([
        ['Totalmente de acuerdo', 23],
        ['Parcialmente de acuerdo', 15],
        [undefined, 7],
        ['Totalmente en desacuerdo', 4],
        ['No sabe', 2]
      ])
    );
  });

  it('separa las respuestas de selección múltiple', () => {
    const ventaja = contar(titulados.flatMap((t) => t.asignaturas_ventaja));
    expect(ventaja.get('Base de Datos')).toBe(140);
    expect(ventaja.get('T.I.S.')).toBe(110);
    expect(contar(empleadores.flatMap((e) => e.cargos)).get('Técnico')).toBe(36);
  });

  it('calcula el segmento junior / consolidado', () => {
    const seg = contar(titulados.map((t) => t.segmento));
    expect(seg.get('Junior (< 5 años)')).toBe(62);
    expect(seg.get('Consolidado (≥ 5 años)')).toBe(83);
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
