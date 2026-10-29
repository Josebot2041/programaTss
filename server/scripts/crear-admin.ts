/**
 * npm run crear-admin -- --ci 1234567 --nombre "Nombre Apellido"
 *
 * Crea una cuenta de administrador o, si ya existe una cuenta con ese CI, la promueve a
 * administrador y la activa (sin cambiar su contraseña). La contraseña se pide por consola sin
 * mostrarla; nunca se pasa como argumento ni queda escrita en el código.
 *
 * Opciones:
 *   --ci                     CI del administrador (obligatorio)
 *   --nombre                 nombre completo (obligatorio solo si la cuenta no existe)
 *   --restablecer-password   también cambia la contraseña de una cuenta existente
 */

import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { errorCi, errorNombre, errorPassword, normalizarCi, normalizarNombre } from '../../src/utils/validacionUsuario';

const USO = 'Uso: npm run crear-admin -- --ci 1234567 --nombre "Nombre Apellido" [--restablecer-password]';

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

let opciones: { ci?: string; nombre?: string; 'restablecer-password'?: boolean };
try {
  opciones = parseArgs({
    options: { ci: { type: 'string' }, nombre: { type: 'string' }, 'restablecer-password': { type: 'boolean' } }
  }).values;
} catch (err) {
  salir(`${err instanceof Error ? err.message : err}\n${USO}`);
}

if (!opciones.ci) salir(`Falta --ci.\n${USO}`);
const problemaCi = errorCi(opciones.ci);
if (problemaCi) salir(problemaCi);
const ci = normalizarCi(opciones.ci)!;

// Sin terminal (entrada redirigida, o Git Bash sin winpty) no se puede ocultar lo que se
// escribe: se leen las líneas de la entrada estándar.
let lineas: AsyncIterator<string> | undefined;
async function leerLinea(): Promise<string> {
  lineas ??= createInterface({ input: process.stdin, terminal: false })[Symbol.asyncIterator]();
  const { value, done } = await lineas.next();
  if (done) salir('No se recibió la contraseña.');
  return value;
}

/** Pide un texto sin mostrarlo en pantalla. */
function pedirOculto(pregunta: string): Promise<string> {
  const entrada = process.stdin;
  process.stdout.write(pregunta);
  if (!entrada.isTTY) return leerLinea();

  return new Promise((resolve) => {
    let valor = '';
    const terminar = () => {
      entrada.setRawMode(false);
      entrada.pause();
      entrada.off('data', alTeclear);
      process.stdout.write('\n');
    };
    const alTeclear = (datos: string) => {
      for (const c of datos) {
        if (c === '\r' || c === '\n') {
          terminar();
          resolve(valor);
          return;
        }
        if (c === '\u0003') {
          terminar();
          salir('Cancelado.');
        }
        if (c === '\u007f' || c === '\b') valor = Array.from(valor).slice(0, -1).join('');
        else if (c >= ' ') valor += c;
      }
    };
    entrada.setRawMode(true);
    entrada.setEncoding('utf8');
    entrada.on('data', alTeclear);
    entrada.resume();
  });
}

async function pedirPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    console.warn('Aviso: la entrada no es una terminal, la contraseña se lee de la entrada estándar.');
  }
  for (let intento = 1; intento <= 3; intento++) {
    const password = await pedirOculto('Contraseña: ');
    const problema = errorPassword(password);
    if (problema) {
      console.error(problema);
      continue;
    }
    if ((await pedirOculto('Repita la contraseña: ')) !== password) {
      console.error('Las contraseñas no coinciden.');
      continue;
    }
    return password;
  }
  salir('No se creó el administrador.');
}

// Se importa aquí para no exigir DATABASE_URL si los argumentos son incorrectos.
const { pool } = await import('../db');
const { hashearPassword } = await import('../usuarios');

try {
  const { rows } = await pool.query<{ id: number; nombre_completo: string; rol: string }>(
    'SELECT id, nombre_completo, rol FROM usuarios WHERE ci = $1',
    [ci]
  );
  const existente = rows[0];

  if (existente) {
    const hash = opciones['restablecer-password'] ? await hashearPassword(await pedirPassword()) : null;
    await pool.query(
      `UPDATE usuarios SET rol = 'admin', activo = true, password_hash = COALESCE($2, password_hash) WHERE id = $1`,
      [existente.id, hash]
    );
    const accion = existente.rol === 'admin' ? 'ya era administrador' : 'ahora es administrador';
    console.log(`${existente.nombre_completo} (CI ${ci}) ${accion}${hash ? '; se cambió su contraseña' : ''}.`);
  } else {
    if (!opciones.nombre) salir(`No existe una cuenta con el CI ${ci}: indique --nombre para crearla.\n${USO}`);
    const problemaNombre = errorNombre(opciones.nombre);
    if (problemaNombre) salir(problemaNombre);
    const nombre = normalizarNombre(opciones.nombre);
    const hash = await hashearPassword(await pedirPassword());
    await pool.query(`INSERT INTO usuarios (nombre_completo, ci, password_hash, rol) VALUES ($1, $2, $3, 'admin')`, [nombre, ci, hash]);
    console.log(`Se creó el administrador ${nombre} (CI ${ci}).`);
  }
} catch (err) {
  console.error('No se pudo crear el administrador:', err instanceof Error ? err.message : err);
  if (err instanceof Error && /does not exist|no existe/.test(err.message)) console.error('¿Ejecutó npm run db:init?');
  process.exitCode = 1;
} finally {
  await pool.end();
}
