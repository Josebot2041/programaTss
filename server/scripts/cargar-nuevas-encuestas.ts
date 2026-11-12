/**
 * npm run cargar-encuestas — genera la base limpia a partir de los Excel crudos de los formularios
 * oficiales (data/encuestas/) y la deja en public/data/Base_Limpia_Titulados_Empleadores.xlsx
 * (hojas Titulados, Empleadores e Items_empleadores), que usan db:seed y el respaldo del frontend.
 * También escribe data/encuestas/reporte_limpieza.md con cada fila descartada o corregida.
 *
 * No toca la base de datos: después de revisar el reporte, ejecute npm run db:seed.
 * Los Excel crudos tienen datos de contacto y no se versionan (.gitignore); la base limpia no los incluye.
 */

import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { limpiarEncuestas, type BaseLimpia, type Correccion } from '../limpiezaEncuestas';
import { ARCHIVOS_BASE_REAL, importarArchivo, NOMBRE_BASE_REAL, type ResultadoImportacion } from '../../src/utils/importador';

const ruta = (relativa: string) => fileURLToPath(new URL(`../../${relativa}`, import.meta.url));

const CARPETA_CRUDOS = 'data/encuestas';
const CRUDO_TITULADOS = `${CARPETA_CRUDOS}/ENCUESTA_DE_OPINION_A_TITULADOS_DE_INGENIERIA_EN_SISTEMAS.xlsx`;
const CRUDO_EMPLEADORES = `${CARPETA_CRUDOS}/ENCUESTA_EMPLEADORES_II_SISTEMAS_respuestas_1.xlsx`;
const BASE_LIMPIA = `public/data/${NOMBRE_BASE_REAL}.xlsx`;
const REPORTE = `${CARPETA_CRUDOS}/reporte_limpieza.md`;
/** Empleadores de la base limpia anterior: conservan sus ids 1 a 51 (ver limpiarEncuestas). */
const EMPLEADORES_ANTERIORES = 51;

const aArrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

async function leerFilas(relativa: string): Promise<unknown[][]> {
  if (!existsSync(ruta(relativa))) {
    console.error(`No se encontró ${relativa}. Copie ahí el Excel exportado del formulario.`);
    process.exit(1);
  }
  const wb = XLSX.read(await readFile(ruta(relativa)));
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
}

const filasTitulados = await leerFilas(CRUDO_TITULADOS);
const filasEmpleadores = await leerFilas(CRUDO_EMPLEADORES);
const base = limpiarEncuestas(filasTitulados, filasEmpleadores, EMPLEADORES_ANTERIORES);

const libro = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(base.titulados), 'Titulados');
XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(base.empleadores), 'Empleadores');
XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(base.items), 'Items_empleadores');
const datos = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer;

// La base nueva debe leerse sin problemas con el mismo importador que usan db:seed y el frontend
const nueva = await importarArchivo(aArrayBuffer(datos), BASE_LIMPIA);
if (nueva.problemas.length > 0) {
  for (const p of nueva.problemas) console.error(`[${p.severidad}] ${p.hoja}, fila ${p.fila}, ${p.columna ?? ''}: ${p.mensaje}`);
  console.error('La base generada no pasa el importador; no se escribió nada.');
  process.exit(1);
}

const anterior = existsSync(ruta(BASE_LIMPIA)) ? await importarArchivo(aArrayBuffer(await readFile(ruta(BASE_LIMPIA))), BASE_LIMPIA) : undefined;

await writeFile(ruta(BASE_LIMPIA), datos);
// Un CSV en public/data tendría prioridad sobre el .xlsx (ver ARCHIVOS_BASE_REAL); la base nueva lo reemplaza
for (const nombre of ARCHIVOS_BASE_REAL.filter((n) => n.endsWith('.csv'))) {
  if (existsSync(ruta(`public/data/${nombre}`))) {
    await rm(ruta(`public/data/${nombre}`));
    console.log(`Se eliminó public/data/${nombre}: la base nueva lo reemplaza.`);
  }
}
await writeFile(ruta(REPORTE), reporte(base, nueva, anterior));

console.log(`Titulados: ${filasTitulados.length - 1} respuestas → ${nueva.titulados?.length} en la base limpia`);
console.log(`Empleadores: ${filasEmpleadores.length - 1} respuestas → ${nueva.empleadores?.length} en la base limpia`);
console.log(`Correcciones: ${base.correcciones.length} · Descartes: ${base.descartes.length}`);
console.log(`Escrito ${BASE_LIMPIA} y ${REPORTE}. Para cargarla en PostgreSQL: npm run db:seed`);

// ---------------------------------------------------------------------------
// Reporte
// ---------------------------------------------------------------------------

function celdaMd(v: string) {
  const t = v.length > 70 ? `${v.slice(0, 67)}…` : v;
  return (t || '—').replace(/\|/g, '\\|');
}

/** Diferencias por campo entre la base anterior y la nueva (las listas se comparan sin orden). */
function diferencias(anterior: ResultadoImportacion, nueva: ResultadoImportacion): { texto: string; hayCambios: boolean } {
  const filas: string[] = [];
  let hayCambios = false;
  for (const hoja of ['titulados', 'empleadores'] as const) {
    const nuevos = new Map((nueva[hoja] ?? []).map((r) => [r.id, r as unknown as Record<string, unknown>]));
    const porCampo = new Map<string, string[]>();
    let sinCambios = 0;
    let faltan = 0;
    for (const viejo of (anterior[hoja] ?? []) as unknown as Array<Record<string, unknown>>) {
      const n = nuevos.get(viejo.id as string);
      if (!n) {
        faltan++;
        continue;
      }
      let cambia = false;
      for (const campo of new Set([...Object.keys(viejo), ...Object.keys(n)])) {
        const norm = (v: unknown) => JSON.parse(JSON.stringify(Array.isArray(v) ? [...v].sort() : (v ?? null)));
        if (!isDeepStrictEqual(norm(viejo[campo]), norm(n[campo]))) {
          porCampo.set(campo, [...(porCampo.get(campo) ?? []), String(viejo.id)]);
          cambia = true;
        }
      }
      if (!cambia) sinCambios++;
    }
    const total = (anterior[hoja] ?? []).length;
    if (porCampo.size > 0 || faltan > 0) hayCambios = true;
    filas.push(`- **${hoja === 'titulados' ? 'Titulados' : 'Empleadores'}**: ${total} en la base anterior; ${total - faltan} siguen con el mismo id y ${sinCambios} no cambian${faltan ? `; ${faltan} ya no están` : ''}.`);
    for (const [campo, ids] of porCampo) filas.push(`  - \`${campo}\`: ${ids.length} (ids ${ids.slice(0, 15).join(', ')}${ids.length > 15 ? ', …' : ''})`);
  }
  return { texto: filas.join('\n'), hayCambios };
}

function reporte(base: BaseLimpia, nueva: ResultadoImportacion, anterior: ResultadoImportacion | undefined): string {
  const nTit = filasTitulados.length - 1;
  const nEmp = filasEmpleadores.length - 1;
  const desc = (hoja: string) => base.descartes.filter((d) => d.hoja === hoja);
  const corregidas = (hoja: string) => new Set(base.correcciones.filter((c) => c.hoja === hoja).map((c) => c.id)).size;

  const porRegla = new Map<string, Correccion[]>();
  for (const c of base.correcciones) {
    const clave = `${c.hoja} · ${c.motivo.replace(/\s*\(\d+(\.\d+)?\)/, '')}`;
    porRegla.set(clave, [...(porRegla.get(clave) ?? []), c]);
  }

  const dif = anterior && diferencias(anterior, nueva);
  const idsEmp = (nueva.empleadores ?? []).map((e) => Number(e.id));
  const nuevosEmp = idsEmp.filter((id) => id > EMPLEADORES_ANTERIORES);

  return `# Reporte de limpieza de las encuestas

Generado por \`npm run cargar-encuestas\` el ${new Date().toISOString().slice(0, 10)} a partir de:

- \`${CRUDO_TITULADOS}\` (Microsoft Forms): ${nTit} respuestas, ${filasTitulados[0]?.length ?? 0} columnas.
- \`${CRUDO_EMPLEADORES}\` (Google Forms): ${nEmp} respuestas, ${filasEmpleadores[0]?.length ?? 0} columnas.

Resultado: \`${BASE_LIMPIA}\` con las hojas Titulados, Empleadores e Items_empleadores. La base se
volvió a leer con el importador de la aplicación sin ningún problema.

## Resumen

| | Titulados | Empleadores |
|---|---:|---:|
| Respuestas en el formulario | ${nTit} | ${nEmp} |
| Descartadas | ${desc('Titulados').length} | ${desc('Empleadores').length} |
| En la base limpia | ${nueva.titulados?.length ?? 0} | ${nueva.empleadores?.length ?? 0} |
| Con al menos una corrección | ${corregidas('Titulados')} | ${corregidas('Empleadores')} |
| Correcciones en total | ${base.correcciones.filter((c) => c.hoja === 'Titulados').length} | ${base.correcciones.filter((c) => c.hoja === 'Empleadores').length} |

Afirmaciones de empleadores (ítems): ${nueva.items?.length ?? 0}.

## Reglas aplicadas

1. **Años escritos como texto → número de años.** «2 años» → 2, «1,5» → 1.5, «Dos años» → 2; los meses
   se dividen entre 12 («6 meses» → 0.5, «Medio año» → 0.5); «Ninguno» o «Nada» → 0; «Más de 10 años» → 10
   (el mínimo declarado). Lo que no es una cantidad de tiempo («n/a», texto sin sentido) queda sin respuesta.
2. **Desempleo mayor que la vida profesional → sin respuesta.**
3. **Respuestas de prueba sin contenido → se descartan** (organización con menos de dos letras distintas,
   como «lll» o «G»), igual que las filas sin los campos obligatorios.
4. **Selección múltiple** («;» en Microsoft Forms, JSON en las actividades, «,» en los cargos de Google
   Forms) → lista separada por «;», que db:seed guarda en las tablas intermedias.
5. **Etiquetas normalizadas a los catálogos** de \`src/data/catalogos.ts\` (por ejemplo «DIRECCIÓN DE
   POSGRADO FCyT» → «Posgrado FCyT», «Grande (100 funcionarios o más)» → «Grande»). Un rubro o cargo
   escrito en «Otro» cuenta como «Otro»; un rubro de empleador fuera del catálogo, como «Otros».

## Filas descartadas

${
  base.descartes.length === 0
    ? 'Ninguna.'
    : `| Hoja | Respuesta | Motivo |\n|---|---:|---|\n${base.descartes.map((d) => `| ${d.hoja} | ${d.id} | ${celdaMd(d.motivo)} |`).join('\n')}`
}

## Correcciones por regla

${[...porRegla]
  .map(
    ([regla, lista]) =>
      `### ${regla} (${lista.length})\n\n| Id | Columna | Antes | Después |\n|---:|---|---|---|\n${lista
        .map((c) => `| ${c.id} | ${c.columna} | ${celdaMd(c.antes)} | ${celdaMd(c.despues)} |`)
        .join('\n')}`
  )
  .join('\n\n')}

## Identificadores

- **Titulados:** conservan el Id de Microsoft Forms (1 a ${nTit}). Los ids 1 a 148 son los mismos
  titulados de la base limpia anterior.
- **Empleadores:** los ${EMPLEADORES_ANTERIORES} de la base anterior conservan su id (1 a ${EMPLEADORES_ANTERIORES}: las primeras respuestas sin
  las de prueba). Las respuestas nuevas usan su número de respuesta en el formulario (${nuevosEmp[0] ?? '—'} a ${nuevosEmp.at(-1) ?? '—'}),
  así que nunca toman un id ya usado.

## Datos que no pasan a la base limpia

- Datos de contacto: correo, nombre, teléfono y LinkedIn de los titulados; correo de los empleadores.
- Textos libres de «Otra asignatura» y «Otr@ área», que no corresponden a ninguna opción del catálogo.
- Columnas de puntos y comentarios que agrega Microsoft Forms.

## Diferencias con la base limpia anterior

${
  !dif
    ? 'No había una base limpia anterior.'
    : !dif.hayCambios
      ? `${dif.texto}\n\nLa base limpia anterior tenía los mismos datos.`
      : `${dif.texto}

Los cambios en registros que ya existían vienen del Excel crudo, que es la fuente: la base anterior tenía
textos dañados (un «0» intercalado en algunos programas y nombres de empresa, o la situación laboral en el
campo empresa), respuestas sin leer (actividades a partir del id 69, varias remuneraciones a partir del
101), «Contabilidad Básica» quitada de 3 listas en que el titulado sí la marcó, «Inteligencia Artificial»
agregada al id 143 desde «Otra asignatura», y en 7 empleadores el texto de habilidades truncado y pegado
con la afirmación 1, que quedaba vacía. En las listas solo se compara el contenido, no el orden (ahora
siguen el orden del catálogo).`
}
`;
}
