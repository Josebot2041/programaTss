/**
 * Piezas de diseño compartidas por todas las pestañas: encabezado, sección, panel, KPI y nota.
 */
import React from 'react';

export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones
}: {
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-slate-600 max-w-3xl">{descripcion}</p>}
      </div>
      {acciones && <div className="shrink-0">{acciones}</div>}
    </header>
  );
}

export function Seccion({
  titulo,
  descripcion,
  children
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
        {descripcion && <p className="mt-0.5 text-sm text-slate-600">{descripcion}</p>}
      </div>
      {children}
    </section>
  );
}

/** Contenedor de un gráfico o tabla: título, interpretación en una línea, contenido y fuente. */
export function Panel({
  titulo,
  interpretacion,
  fuente,
  children,
  className = ''
}: {
  titulo: string;
  interpretacion?: React.ReactNode;
  fuente?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure className={`min-w-0 bg-white border border-slate-200 rounded-md p-5 flex flex-col ${className}`}>
      <figcaption className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
        {interpretacion && <p className="mt-1 text-sm text-slate-600">{interpretacion}</p>}
      </figcaption>
      <div className="flex-1">{children}</div>
      {fuente && <p className="mt-3 text-xs text-slate-500">Fuente: {fuente}</p>}
    </figure>
  );
}

/** Indicador: número grande, etiqueta corta y una línea de contexto. */
export function Kpi({ valor, etiqueta, contexto }: { valor: string; etiqueta: string; contexto?: string }) {
  return (
    <div className="min-w-0 bg-white border border-slate-200 rounded-md px-4 py-4 sm:px-5">
      <div className="text-sm text-slate-600">{etiqueta}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">{valor}</div>
      {contexto && <div className="mt-1 text-xs text-slate-500">{contexto}</div>}
    </div>
  );
}

export function FilaKpi({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>;
}

/** Nota con borde lateral: naranja para resaltar, gris para información. */
export function Nota({ tono = 'neutro', children }: { tono?: 'resalte' | 'neutro'; children: React.ReactNode }) {
  const estilos =
    tono === 'resalte' ? 'border-resalte bg-resalte-fondo text-slate-800' : 'border-slate-300 bg-slate-50 text-slate-700';
  return <div className={`border-l-4 ${estilos} px-4 py-3 text-sm`}>{children}</div>;
}

/** Selector de opciones excluyentes (por ejemplo, el filtro de segmento). */
export function Selector<T extends string>({
  opciones,
  valor,
  onCambiar,
  etiqueta
}: {
  opciones: Array<{ valor: T; texto: string }>;
  valor: T;
  onCambiar: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex border border-slate-300 rounded-md overflow-hidden text-sm">
      {opciones.map((o, i) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onCambiar(o.valor)}
          className={`px-3 py-1.5 ${i > 0 ? 'border-l border-slate-300' : ''} ${
            valor === o.valor ? 'bg-institucional text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}
