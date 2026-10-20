/**
 * Paleta y estilos compartidos por los gráficos (Recharts necesita los colores como valores).
 * Los mismos colores están definidos como tokens de Tailwind en src/index.css.
 *
 * Regla: azul institucional para los datos, naranja solo para resaltar, grises para el resto.
 * Una misma categoría usa siempre el mismo color en toda la aplicación.
 */

export const COLOR = {
  azul: '#1F4E79',
  azulMedio: '#4F7CAC',
  azulClaro: '#A9C1DB',
  naranja: '#C8641E',
  grisOscuro: '#4B5563',
  gris: '#9CA3AF',
  grisClaro: '#E5E7EB',
  texto: '#1F2937',
  textoSecundario: '#6B7280'
} as const;

/** Colores fijos por categoría, para que coincidan en todos los gráficos. */
export const COLOR_CATEGORIA: Record<string, string> = {
  'Junior (< 5 años)': COLOR.azulClaro,
  'Consolidado (≥ 5 años)': COLOR.azul,
  Privado: COLOR.azul,
  Público: COLOR.gris,
  Hombre: COLOR.azul,
  Mujer: COLOR.azulMedio,
  // Escalas Likert (titulados y empleadores): el desacuerdo total se resalta en naranja
  'Totalmente de acuerdo': COLOR.azul,
  'De acuerdo': COLOR.azulClaro,
  'Parcialmente de acuerdo': COLOR.azulClaro,
  'En desacuerdo': COLOR.gris,
  'Totalmente en desacuerdo': COLOR.naranja,
  'No sabe': COLOR.grisClaro
};

export const EJE = {
  tick: { fontSize: 12, fill: COLOR.textoSecundario },
  tickCategoria: { fontSize: 12, fill: COLOR.texto }
} as const;
