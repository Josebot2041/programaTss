import { describe, expect, it } from 'vitest';
import { hashDeRuta, rutaDeHash } from './rutas';

describe('rutas', () => {
  it.each([
    ['', { vista: 'portada' }],
    ['#', { vista: 'portada' }],
    ['#inicio', { vista: 'portada' }],
    ['#encuesta-titulados', { vista: 'encuesta-titulados' }],
    ['#encuesta-empleadores', { vista: 'encuesta-empleadores' }],
    ['#admin-login', { vista: 'admin-login' }],
    ['#panel', { vista: 'panel', seccion: 'overview' }],
    ['#panel/titulados', { vista: 'panel', seccion: 'titulados' }],
    ['#panel/admin_usuarios', { vista: 'panel', seccion: 'admin_usuarios' }],
    ['#panel/informe', { vista: 'panel', seccion: 'overview', informe: true }],
    ['#panel/no-existe', { vista: 'panel', seccion: 'overview' }],
    ['#cualquier-cosa', { vista: 'portada' }]
  ])('%s', (hash, ruta) => {
    expect(rutaDeHash(hash)).toEqual(ruta);
  });

  it('los enlaces de antes del rediseño siguen funcionando', () => {
    expect(rutaDeHash('#titulados')).toEqual({ vista: 'panel', seccion: 'titulados' });
    expect(rutaDeHash('#informe')).toEqual({ vista: 'panel', seccion: 'overview', informe: true });
    expect(rutaDeHash('#encuesta_titulados')).toEqual({ vista: 'encuesta-titulados' });
  });

  it('las encuestas ya no son secciones del panel', () => {
    expect(rutaDeHash('#panel/encuesta_titulados')).toEqual({ vista: 'panel', seccion: 'overview' });
  });

  it('hashDeRuta es el inverso de rutaDeHash', () => {
    for (const hash of ['#encuesta-titulados', '#encuesta-empleadores', '#admin-login', '#panel/mercado']) {
      expect(hashDeRuta(rutaDeHash(hash))).toBe(hash);
    }
    expect(hashDeRuta({ vista: 'portada' })).toBe('');
  });
});
