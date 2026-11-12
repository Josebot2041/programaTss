import { CAMPO_TRAMPA } from '../../src/utils/validacion';
import { crearEmpleador } from './empleadores';
import { crearTitulado } from './titulados';
import type { Manejador } from './tipos';

/**
 * Encuesta pública (sin cuenta): las mismas reglas y el mismo guardado (origen 'formulario') que
 * la ruta del panel. Si el campo trampa viene lleno, es un bot: se responde como si se hubiera
 * guardado, para no darle pistas, pero no se guarda nada. El límite de envíos por IP se aplica en
 * server/app.ts.
 */
function encuestaPublica(crear: Manejador): Manejador {
  return async (peticion) => {
    const cuerpo = typeof peticion.body === 'object' && peticion.body !== null ? (peticion.body as Record<string, unknown>) : undefined;
    if (cuerpo && typeof cuerpo[CAMPO_TRAMPA] === 'string' && cuerpo[CAMPO_TRAMPA].trim() !== '') {
      return { status: 201, body: { ok: true } };
    }
    return crear(peticion);
  };
}

/** POST /api/publico/titulados */
export const crearTituladoPublico = encuestaPublica(crearTitulado);

/** POST /api/publico/empleadores */
export const crearEmpleadorPublico = encuestaPublica(crearEmpleador);
