import { describe, expect, it } from 'vitest';
import { numOrden, pct, unirDos, unirLista } from './formato';

describe('Formato de textos y números', () => {
  it('usa "e" ante sonido /i/ y "y" en los demás casos', () => {
    expect(unirDos('IA', 'Ingeniería de Software')).toBe('IA e Ingeniería de Software');
    expect(unirDos('padres', 'hijos')).toBe('padres e hijos');
    expect(unirDos('agua', 'hielo')).toBe('agua y hielo');
    expect(unirDos('Diplomado', 'maestría')).toBe('Diplomado y maestría');
    expect(unirLista(['A', 'B', 'Inglés'])).toBe('A, B e Inglés');
  });

  it('porcentajes con 1 decimal; medianas enteras sin decimales', () => {
    expect(pct(43.88)).toBe('43.9%');
    expect(numOrden(6)).toBe('6');
    expect(numOrden(0.75)).toBe('0.75');
  });
});
