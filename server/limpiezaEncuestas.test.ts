import { describe, expect, it } from 'vitest';
import { aniosDeTexto, esTextoDePrueba, limpiarEncuestas } from './limpiezaEncuestas';

describe('aniosDeTexto', () => {
  it.each([
    ['6', 6],
    ['2 años', 2],
    ['2 anios', 2],
    ['1,5', 1.5],
    ['0.5', 0.5],
    ['Dos años', 2],
    ['6 meses', 0.5],
    ['2 MESES', 0.17],
    ['Unos 3 meses', 0.25],
    ['6 meses - voluntad propia', 0.5],
    ['Medio año', 0.5],
    ['Ninguno, siempre estuve con trabajo', 0],
    ['Nada', 0],
    ['Más de 10 años', 10]
  ])('«%s» → %s', (texto, anios) => {
    expect(aniosDeTexto(texto)).toBe(anios);
  });

  it.each(['', 'n/a', 'Gjvu'])('«%s» no es una cantidad de tiempo', (texto) => {
    expect(aniosDeTexto(texto)).toBeUndefined();
  });
});

it('esTextoDePrueba: menos de dos letras distintas', () => {
  expect(esTextoDePrueba('lll')).toBe(true);
  expect(esTextoDePrueba('G')).toBe(true);
  expect(esTextoDePrueba('-')).toBe(true);
  expect(esTextoDePrueba('cyty')).toBe(false);
  expect(esTextoDePrueba('MTM')).toBe(false);
});

// Filas con la misma disposición de columnas que los Excel de Microsoft Forms y Google Forms
function filaTitulado(valores: Record<number, string>): string[] {
  return Array.from({ length: 167 }, (_, i) => valores[i] ?? '');
}
const ENCABEZADO_T = filaTitulado({
  0: 'Id',
  8: 'Edad que tiene actualmente:',
  43: '¿CUÁNTOS SON LOS AÑOS DE VIDA PROFESIONAL QUE LLEVA HASTA LA FECHA?',
  49: '¿CUÁL DE LAS SIGUIENTES AFIRMACIONES DESCRIBE SU SITUACIÓN LABORAL ACTUAL?',
  155: '¿Le interesaría formar parte una red de contactos oficial…',
  158: 'Email de contacto:',
  161: 'Número telefónico de contacto'
});
const titulado = (id: string, extra: Record<number, string> = {}) =>
  filaTitulado({ 0: id, 8: '27 - 30 años', 11: 'Mujer', 14: 'NO', 49: 'Actualmente NO trabajo', 158: 'persona@correo.com', 161: '70000000', ...extra });

function filaEmpleador(valores: Record<number, string>): string[] {
  return Array.from({ length: 32 }, (_, i) => valores[i] ?? '');
}
const ENCABEZADO_E = filaEmpleador({
  1: 'Dirección de correo electrónico',
  2: '1) Nombre de la Empresa o Institución',
  3: '2) Tipo de organización',
  10: '9) ¿Qué tipo de cargos desempeñan…?',
  14: ' [La Carrera … brinda confianza …]',
  31: ' [He sido consultado … autoevaluación …]'
});
const empleador = (organizacion: string, extra: Record<number, string> = {}) =>
  filaEmpleador({ 1: 'contacto@empresa.com', 2: organizacion, 3: 'Privado', 4: 'Micro (hasta 10 funcionarios)', 14: 'Totalmente desacuerdo', ...extra });

describe('limpiarEncuestas', () => {
  const base = limpiarEncuestas(
    [
      ENCABEZADO_T,
      titulado('1', {
        43: '2 años',
        46: '6 meses',
        137: 'La distribución de los horarios de clases.;El desarrollo de habilidades analíticas y de resolución de problemas.;',
        149: 'Básicas (Física, Calculo, Algebras);Aplic. Interactivas para Televisión Digital;'
      }),
      titulado('2', { 43: '1', 46: '4 años', 67: '["Computo","Desarrollo","R.R.H.H."]', 20: 'DIRECCIÓN DE POSGRADO FCyT', 14: 'SI' }),
      titulado('3', { 11: '' })
    ],
    [
      ENCABEZADO_E,
      empleador('Primera SRL', {
        4: 'Grande (100 funcionarios o más)',
        10: 'De apoyo / asistencia tecnológica, Técnico (desarrollo de software, administración de sistemas, redes), Docentes'
      }),
      empleador('lll'),
      empleador('Segunda SRL', { 5: 'Seguridad informática / ciberseguridad' }),
      empleador('Nueva SRL')
    ],
    2
  );
  const columnas = base.titulados[0];
  const fila = (id: string) => Object.fromEntries(columnas.map((c, i) => [c, base.titulados.find((f) => f[0] === id)?.[i]]));
  const empleadores = base.empleadores.slice(1).map((f) => Object.fromEntries(base.empleadores[0].map((c, i) => [c, f[i]])));

  it('convierte los años escritos como texto y anota la corrección', () => {
    expect(fila('1')).toMatchObject({ anios_vida_profesional: 2, anios_desempleado: 0.5 });
    expect(base.correcciones).toContainEqual(
      expect.objectContaining({ id: '1', columna: 'anios_desempleado', antes: '6 meses', despues: '0.5' })
    );
  });

  it('deja sin respuesta el desempleo mayor que la vida profesional', () => {
    expect(fila('2').anios_desempleado).toBe('');
    expect(base.correcciones).toContainEqual(expect.objectContaining({ id: '2', columna: 'anios_desempleado', antes: '4' }));
  });

  it('normaliza etiquetas y selección múltiple a los catálogos (en su orden)', () => {
    expect(fila('1')).toMatchObject({
      situacion_laboral: 'No trabaja',
      aspectos_utiles: 'Habilidades analíticas y resolución de problemas; Distribución de horarios',
      asignaturas_no_utiles: 'Aplic. Interactivas TV Digital; Básicas (Física, Cálculo, Álgebra)'
    });
    expect(fila('2')).toMatchObject({ formacion_complementaria: 'Sí', lugar_realizado: 'Posgrado FCyT', actividades: 'Desarrollo; Cómputo' });
    expect(base.correcciones).toContainEqual(expect.objectContaining({ id: '2', columna: 'actividades', antes: 'R.R.H.H.' }));
  });

  it('descarta filas sin campos obligatorios y respuestas de prueba', () => {
    expect(base.titulados.map((f) => f[0])).toEqual(['id', '1', '2']);
    expect(base.descartes).toEqual([
      { hoja: 'Titulados', id: '3', motivo: 'Faltan campos obligatorios: genero' },
      { hoja: 'Empleadores', id: '2', motivo: 'Respuesta de prueba (organización «lll»)' }
    ]);
  });

  it('empleadores: tamaño y cargos del catálogo, rubro desconocido → Otros, Likert normalizado', () => {
    expect(empleadores[0]).toMatchObject({
      tamano: 'Grande',
      cargos: 'Técnico; Apoyo / asistencia tecnológica',
      item_01: 'Totalmente en desacuerdo'
    });
    expect(empleadores[1].rubro).toBe('Otros');
  });

  it('los empleadores anteriores conservan su id y los nuevos usan su número de respuesta', () => {
    expect(empleadores.map((e) => [e.id, e.organizacion])).toEqual([
      ['1', 'Primera SRL'],
      ['2', 'Segunda SRL'],
      ['4', 'Nueva SRL']
    ]);
  });

  it('no copia datos de contacto a la base limpia', () => {
    const todo = JSON.stringify([base.titulados, base.empleadores]);
    expect(todo).not.toContain('@');
    expect(todo).not.toContain('70000000');
  });

  it('se detiene si el formulario cambió de columnas', () => {
    expect(() => limpiarEncuestas([filaTitulado({ 0: 'Id' })], [ENCABEZADO_E], 0)).toThrow(/Cambió el formulario/);
  });
});
