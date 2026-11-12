import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { aCSV, aXlsx, filasEmpleadores, filasResultados, filasTitulados } from './exportador';
import { leerBaseRealLocal } from './baseRealLocal';
import { importarArchivo } from './importador';

const leer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const base = await leerBaseRealLocal();
const titulados = base.titulados ?? [];
const empleadores = base.empleadores ?? [];

describe('Exportación', () => {
  it('CSV con BOM UTF-8 y ";" que se reimporta sin pérdidas', async () => {
    const csv = aCSV(filasTitulados(titulados));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split('\r\n')[0]).toContain('id;edad;genero;');
    const reimportado = await importarArchivo(leer(Buffer.from(csv, 'utf-8')), 'titulados.csv');
    expect(reimportado.problemas).toEqual([]);
    expect(reimportado.titulados).toEqual(titulados);

    const csvEmp = aCSV(filasEmpleadores(empleadores));
    const emp = await importarArchivo(leer(Buffer.from(csvEmp, 'utf-8')), 'empleadores.csv');
    expect(emp.empleadores).toEqual(empleadores);
  });

  it('.xlsx con las hojas Titulados, Empleadores y Resultados', async () => {
    const datos = await aXlsx(titulados, empleadores);
    expect(XLSX.read(datos, { type: 'array' }).SheetNames).toEqual(['Titulados', 'Empleadores', 'Resultados']);
    const reimportado = await importarArchivo(datos, 'base.xlsx');
    expect(reimportado.titulados).toEqual(titulados);
    expect(reimportado.empleadores).toEqual(empleadores);
  });

  it('la hoja Resultados contiene los valores de control', () => {
    const filas = filasResultados(titulados, empleadores);
    const valor = (indicador: string) => filas.find((f) => f[1] === indicador)?.[2];
    expect(valor('Años de vida profesional: media')).toBe(9.0359);
    expect(valor('Dos áreas principales (%)')).toBe(69);
    expect(valor('Nivel del programa × fuente de financiamiento: p oficial')).toBe(0.1121);
    expect(valor('Índice: Participación del empleador en la mejora de la Carrera')).toBe(39.5);
  });
});
