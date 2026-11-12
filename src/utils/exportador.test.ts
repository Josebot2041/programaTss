import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { aCSV, aXlsx, filasEmpleadores, filasResultados, filasTitulados, neutralizarFormula } from './exportador';
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

describe('Inyección de fórmulas en CSV y Excel', () => {
  const peligrosos = ['=HYPERLINK("http://ejemplo.com","clic")', '+1+1', '-2+3', '@SUM(A1:A2)', '\tpestaña', '\rretorno'];

  it.each(peligrosos)('neutraliza «%s» con un apóstrofo', (texto) => {
    expect(neutralizarFormula(texto)).toBe(`'${texto}`);
  });

  it('no toca los números (tampoco los negativos) ni los textos comunes', () => {
    expect(neutralizarFormula(-3.5)).toBe(-3.5);
    expect(neutralizarFormula(0)).toBe(0);
    for (const texto of ['Desarrollo de Software', '', 'Bs. 7.000', "O'Brien", 'a=b']) expect(neutralizarFormula(texto)).toBe(texto);
  });

  // Titulados y empleadores con textos libres que una planilla ejecutaría como fórmula
  const tituladoPeligroso = { ...titulados[0], programa: '=CMD|" /C calc"!A0', empresa: '@empresa' };
  const empleadorPeligroso = { ...empleadores[0], organizacion: '+Organización', tendencias: '-IA y datos', habilidades: '=1+1' };

  it('el CSV escribe esos textos con apóstrofo y al reimportarlo se recuperan sin él', async () => {
    const csv = aCSV(filasTitulados([tituladoPeligroso]));
    // Lleva comillas, así que además va entre comillas con las internas duplicadas
    expect(csv).toContain(`;"'=CMD|"" /C calc""!A0";`);
    expect(csv).toContain(";'@empresa;");
    expect(csv).not.toMatch(/;[=+\-@]/);
    const reimportado = await importarArchivo(leer(Buffer.from(csv, 'utf-8')), 'titulados.csv');
    expect(reimportado.titulados?.[0]).toEqual(tituladoPeligroso);
  });

  it('el .xlsx guarda esos textos con apóstrofo en las tres hojas, sin fórmulas, y se reimportan igual', async () => {
    const datos = await aXlsx([tituladoPeligroso], [empleadorPeligroso]);
    const libro = XLSX.read(datos, { type: 'array', cellFormula: true });
    const celdas = Object.values(libro.Sheets).flatMap((hoja) =>
      Object.entries(hoja)
        .filter(([ref]) => !ref.startsWith('!'))
        .map(([, celda]) => celda as XLSX.CellObject)
    );
    expect(celdas.filter((c) => c.f !== undefined)).toEqual([]);
    expect(celdas.filter((c) => typeof c.v === 'string' && /^[=+\-@\t\r]/.test(c.v))).toEqual([]);
    expect(celdas.map((c) => c.v)).toEqual(expect.arrayContaining([`'=CMD|" /C calc"!A0`, "'@empresa", "'+Organización", "'-IA y datos", "'=1+1"]));

    const reimportado = await importarArchivo(datos, 'base.xlsx');
    expect(reimportado.titulados?.[0]).toEqual(tituladoPeligroso);
    expect(reimportado.empleadores?.[0]).toEqual(empleadorPeligroso);
  });
});
