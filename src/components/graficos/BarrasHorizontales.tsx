import React, { useEffect, useState } from 'react';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { COLOR, EJE } from '../../ui/tema';
import { pct } from '../../utils/formato';

/** true en pantallas de menos de 640 px (móvil), para reducir el espacio de las etiquetas. */
export function usePantallaAngosta(): boolean {
  const consulta = '(max-width: 639px)';
  const [angosto, setAngosto] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const alCambiar = () => setAngosto(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);
  return angosto;
}

/** Etiqueta a la derecha de la barra, en una sola línea (la de Recharts parte el texto). */
function EtiquetaValor(props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: unknown }) {
  const x = Number(props.x ?? 0) + Number(props.width ?? 0) + 6;
  const y = Number(props.y ?? 0) + Number(props.height ?? 0) / 2;
  return (
    <text x={x} y={y} dominantBaseline="central" fontSize={12} fill={COLOR.texto}>
      {String(props.value ?? '')}
    </text>
  );
}

export interface DatoBarra {
  categoria: string;
  n: number;
  porcentaje: number;
}

/**
 * Barras horizontales de frecuencias. Cada barra muestra el porcentaje y, entre paréntesis, n.
 * `resaltar` pinta en naranja las categorías que la interpretación menciona.
 */
export function BarrasHorizontales({
  datos,
  resaltar = [],
  anchoEtiquetas = 170,
  color = COLOR.azul
}: {
  datos: DatoBarra[];
  resaltar?: string[];
  anchoEtiquetas?: number;
  color?: string;
}) {
  const angosto = usePantallaAngosta();
  const filas = datos.map((d) => ({ ...d, etiqueta: `${pct(d.porcentaje)} (${d.n})` }));
  const maximo = Math.max(...filas.map((d) => d.porcentaje), 1);
  return (
    <ResponsiveContainer width="100%" height={filas.length * (angosto ? 44 : 30) + 10}>
      <BarChart data={filas} layout="vertical" margin={{ top: 0, right: 80, bottom: 0, left: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide domain={[0, maximo]} />
        <YAxis
          type="category"
          dataKey="categoria"
          width={angosto ? Math.min(anchoEtiquetas, 120) : anchoEtiquetas}
          tick={EJE.tickCategoria}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <Bar dataKey="porcentaje" isAnimationActive={false} maxBarSize={18}>
          {filas.map((d) => (
            <Cell key={d.categoria} fill={resaltar.includes(d.categoria) ? COLOR.naranja : color} />
          ))}
          <LabelList dataKey="etiqueta" content={EtiquetaValor} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
