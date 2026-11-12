/**
 * Rutas de la web, en el hash de la URL (no hace falta configurar el servidor):
 *
 *   /                        portada pública
 *   /#encuesta-titulados     encuesta pública a titulados (sin cuenta)
 *   /#encuesta-empleadores   encuesta pública a empleadores (sin cuenta)
 *   /#admin-login            acceso de administradores
 *   /#panel/<sección>        panel de análisis (solo administradores)
 */

import { NAVEGACION, NAVEGACION_ADMIN } from './components/Sidebar';

export type Ruta =
  | { vista: 'portada' }
  | { vista: 'encuesta-titulados' }
  | { vista: 'encuesta-empleadores' }
  | { vista: 'admin-login' }
  | { vista: 'panel'; seccion: string; informe?: boolean };

export const SECCION_INICIAL = 'overview';

/** Secciones del panel (las del Sidebar). */
export const SECCIONES_PANEL = [...NAVEGACION, NAVEGACION_ADMIN].flatMap((s) => s.items.map((i) => i.id));

const PANEL_INICIAL: Extract<Ruta, { vista: 'panel' }> = { vista: 'panel', seccion: SECCION_INICIAL };

/** Enlaces de antes del rediseño (#titulados, #informe, #encuesta_titulados…) que siguen funcionando. */
const ANTERIORES: Record<string, Ruta> = {
  encuesta_titulados: { vista: 'encuesta-titulados' },
  encuesta_empleadores: { vista: 'encuesta-empleadores' },
  informe: { ...PANEL_INICIAL, informe: true }
};

export function rutaDeHash(hash: string): Ruta {
  const h = hash.replace(/^#\/?/, '');
  if (h === '' || h === 'inicio') return { vista: 'portada' };
  if (h === 'encuesta-titulados' || h === 'encuesta-empleadores' || h === 'admin-login') return { vista: h };
  if (h === 'panel' || h.startsWith('panel/')) {
    const seccion = h.slice('panel/'.length);
    if (seccion === 'informe') return { ...PANEL_INICIAL, informe: true };
    return SECCIONES_PANEL.includes(seccion) ? { vista: 'panel', seccion } : PANEL_INICIAL;
  }
  if (ANTERIORES[h]) return ANTERIORES[h];
  if (SECCIONES_PANEL.includes(h)) return { vista: 'panel', seccion: h };
  return { vista: 'portada' };
}

/** Hash de una ruta ('' para la portada). El informe se abre desde el panel, no tiene hash propio. */
export function hashDeRuta(ruta: Ruta): string {
  if (ruta.vista === 'portada') return '';
  if (ruta.vista === 'panel') return `#panel/${ruta.seccion}`;
  return `#${ruta.vista}`;
}

export const esRutaDelPanel = (ruta: Ruta): ruta is Extract<Ruta, { vista: 'panel' }> => ruta.vista === 'panel';
