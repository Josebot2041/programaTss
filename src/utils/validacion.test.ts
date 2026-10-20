import { describe, expect, it } from 'vitest';
import { CODIGOS_ITEMS } from '../data/catalogos';
import { BORRADOR_EMPLEADOR_VACIO, BORRADOR_TITULADO_VACIO, siguienteId, validarEmpleador, validarTitulado, type BorradorTitulado } from './validacion';

const completo: BorradorTitulado = {
  ...BORRADOR_TITULADO_VACIO,
  edad: '23 - 26 años',
  genero: 'Mujer',
  anios_vida_profesional: '3',
  anios_desempleado: '0.5',
  formacion_complementaria: 'No',
  interes_posgrado: 'No',
  situacion_laboral: 'No trabaja',
  satisfaccion_global: 3,
  concordancia_formacion: 2,
  opinion_posgrado_fcyt: 3
};

describe('Validación del formulario de titulados', () => {
  it('un formulario vacío no se guarda y marca los obligatorios', () => {
    const r = validarTitulado(BORRADOR_TITULADO_VACIO, '149');
    expect(r.registro).toBeUndefined();
    expect(Object.keys(r.errores)).toEqual(expect.arrayContaining(['edad', 'genero', 'anios_vida_profesional', 'anios_desempleado', 'situacion_laboral']));
  });

  it('el desempleo no puede superar los años de vida profesional', () => {
    const r = validarTitulado({ ...completo, anios_vida_profesional: '2', anios_desempleado: '3' }, '149');
    expect(r.errores.anios_desempleado).toBe('No puede superar los años de vida profesional');
    expect(r.registro).toBeUndefined();
  });

  it('las preguntas condicionales son obligatorias solo cuando aplican', () => {
    expect(validarTitulado({ ...completo, situacion_laboral: 'Trabaja en una organización' }, '149').errores.sector).toBeDefined();
    expect(validarTitulado({ ...completo, formacion_complementaria: 'Sí' }, '149').errores.nivel_realizado).toBeDefined();
  });

  it('un formulario completo genera un registro sin valores inventados', () => {
    const r = validarTitulado(completo, '149');
    expect(r.errores).toEqual({});
    expect(r.registro).toMatchObject({ id: '149', anios_vida_profesional: 3, anios_desempleado: 0.5, segmento: 'Junior (< 5 años)' });
    expect(r.registro?.sector).toBeUndefined();
    expect(r.registro?.actividades).toEqual([]);
  });

  it('asigna el siguiente identificador libre', () => {
    expect(siguienteId(['1', '2', '148'])).toBe('149');
    expect(siguienteId([])).toBe('1');
  });
});

describe('Validación del formulario de empleadores', () => {
  it('exige los datos básicos y las 18 afirmaciones', () => {
    const r = validarEmpleador(BORRADOR_EMPLEADOR_VACIO, '52');
    expect(Object.keys(r.errores)).toEqual(expect.arrayContaining(['organizacion', 'tipo', 'tamano', 'items_likert']));
    const items = Object.fromEntries(CODIGOS_ITEMS.map((c) => [c, 'No sabe' as const]));
    const ok = validarEmpleador(
      {
        ...BORRADOR_EMPLEADOR_VACIO,
        organizacion: 'Empresa de prueba',
        tipo: 'Privado',
        tamano: 'Micro',
        rubro: 'Otros',
        contrato_5_anios: 'No',
        posibilidad_contratacion: 'No prevista actualmente',
        nivel_demandado: 'Licenciatura',
        items_likert: items
      },
      '52'
    );
    expect(ok.errores).toEqual({});
    expect(ok.registro?.organizacion).toBe('Empresa de prueba');
  });
});
