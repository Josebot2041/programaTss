/**
 * Formato numérico uniforme de la interfaz: punto decimal y porcentajes con 1 decimal.
 */

/** Porcentaje (valor de 0 a 100) con 1 decimal: 43.9% */
export function pct(valor: number | null | undefined, decimales = 1): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return `${valor.toFixed(decimales)}%`;
}

/** Número con decimales fijos: 8.83 */
export function num(valor: number | null | undefined, decimales = 2): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return valor.toFixed(decimales);
}

/** Mediana, cuartiles y extremos: sin decimales si el valor es entero (6), si no con 2 (0.75). */
export function numOrden(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(2);
}

/** Entero con espacio como separador de miles: 100 000 (el punto queda solo para decimales). */
export function entero(valor: number): string {
  return String(Math.round(valor)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** p-valor con 4 decimales, o "< 0.0001" si es menor. */
export function pValorTexto(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return '—';
  return p < 0.0001 ? '< 0.0001' : p.toFixed(4);
}

/** "p = 0.0452" o "p < 0.0001" (para frases y notas). */
export function textoP(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return 'p = —';
  return p < 0.0001 ? 'p < 0.0001' : `p = ${p.toFixed(4)}`;
}

/** Porcentaje de una parte sobre un total (0 si el total es 0). */
export function porcentaje(parte: number, total: number): number {
  return total > 0 ? (100 * parte) / total : 0;
}

/**
 * Conjunción copulativa ante la palabra siguiente: "e" si empieza con sonido /i/
 * ("IA e Ingeniería de Software"), salvo "hie-" ("agua y hielo"); "y" en los demás casos.
 */
export function conjuncionY(siguiente: string): 'y' | 'e' {
  const inicio = siguiente.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return /^h?i/.test(inicio) && !/^hi[aeou]/.test(inicio) ? 'e' : 'y';
}

/** Une dos elementos con la conjunción correcta: "A y B" o "A e I…". */
export function unirDos(a: string, b: string): string {
  return `${a} ${conjuncionY(b)} ${b}`;
}

/** Une una lista en español: "A", "A y B", "A, B y C" (con "e" ante /i/). */
export function unirLista(elementos: string[]): string {
  if (elementos.length <= 1) return elementos.join('');
  return unirDos(elementos.slice(0, -1).join(', '), elementos[elementos.length - 1]);
}
