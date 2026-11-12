/**
 * Lectura de la base real desde public/data en Node (db:seed, db:verificar y pruebas), con la
 * misma prioridad que el frontend: primero el CSV y, lo que no traiga, del .xlsx.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importarBaseReal, type BaseReal } from './importador';

export const CARPETA_DATOS = fileURLToPath(new URL('../../public/data/', import.meta.url));

export function leerBaseRealLocal(carpeta = CARPETA_DATOS): Promise<BaseReal> {
  return importarBaseReal(async (nombre) => {
    const ruta = join(carpeta, nombre);
    if (!existsSync(ruta)) return undefined;
    const b = await readFile(ruta);
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  });
}
