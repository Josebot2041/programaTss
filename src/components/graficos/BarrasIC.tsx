import React from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { COLOR, EJE } from '../../ui/tema';
import { num } from '../../utils/formato';

export interface DatoIC {
  categoria: string;
  media: number;
  /** Semiamplitud del intervalo de confianza. */
  margen: number;
  resaltar?: boolean;
}

interface PropsForma {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: DatoIC;
}

/**
 * Barra con su intervalo de confianza dibujado encima. La escala vertical se obtiene de la propia
 * barra (alto en píxeles / media), así el bigote queda en el valor exacto.
 */
function BarraConIntervalo({ x = 0, y = 0, width = 0, height = 0, payload }: PropsForma) {
  if (!payload) return null;
  const color = payload.resaltar ? COLOR.azul : COLOR.azulClaro;
  const pixelesPorUnidad = payload.media > 0 ? height / payload.media : 0;
  const arriba = y - payload.margen * pixelesPorUnidad;
  const abajo = y + payload.margen * pixelesPorUnidad;
  const centro = x + width / 2;
  const bigote = Math.min(12, width / 3);
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} />
      {payload.margen > 0 && pixelesPorUnidad > 0 && (
        <g stroke={COLOR.texto} strokeWidth={1.5}>
          <line x1={centro} x2={centro} y1={arriba} y2={abajo} />
          <line x1={centro - bigote / 2} x2={centro + bigote / 2} y1={arriba} y2={arriba} />
          <line x1={centro - bigote / 2} x2={centro + bigote / 2} y1={abajo} y2={abajo} />
        </g>
      )}
    </g>
  );
}

/** Columnas con la media y su intervalo de confianza; línea opcional de referencia (umbral). */
export function BarrasIC({
  datos,
  referencia,
  decimales = 1,
  alto = 320
}: {
  datos: DatoIC[];
  referencia?: { valor: number; texto: string };
  decimales?: number;
  alto?: number;
}) {
  const filas = datos.map((d) => ({ ...d, etiqueta: num(d.media, decimales), tope: d.media + d.margen }));
  const maximo = Math.max(...filas.map((d) => d.tope), referencia?.valor ?? 0, 1);
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={filas} margin={{ top: 24, right: 12, bottom: 0, left: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={COLOR.grisClaro} />
        <XAxis dataKey="categoria" tick={EJE.tick} tickLine={false} axisLine={{ stroke: COLOR.gris }} interval={0} />
        <YAxis domain={[0, Math.ceil(maximo * 1.12)]} tick={EJE.tick} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          cursor={{ fill: COLOR.grisClaro, opacity: 0.4 }}
          formatter={(valor, _nombre, item) => {
            const margen = Number((item?.payload as DatoIC | undefined)?.margen ?? 0);
            return [`${num(Number(valor), decimales)} ± ${num(margen, decimales)}`, 'Media (IC 95%)'];
          }}
        />
        <Bar dataKey="media" isAnimationActive={false} maxBarSize={56} shape={(props: unknown) => <BarraConIntervalo {...(props as PropsForma)} />}>
          {/* La etiqueta va sobre el extremo superior del intervalo */}
          <LabelList dataKey="etiqueta" content={EtiquetaSobreIntervalo(filas)} />
        </Bar>
        {referencia && (
          <ReferenceLine
            y={referencia.valor}
            stroke={COLOR.naranja}
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{ value: referencia.texto, position: 'insideTopRight', fontSize: 12, fill: COLOR.naranja }}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

function EtiquetaSobreIntervalo(filas: Array<DatoIC & { etiqueta: string }>) {
  return function Etiqueta(props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number }) {
    const fila = filas[props.index ?? 0];
    if (!fila) return null;
    const alto = Number(props.height ?? 0);
    const pixelesPorUnidad = fila.media > 0 ? alto / fila.media : 0;
    const y = Number(props.y ?? 0) - fila.margen * pixelesPorUnidad - 6;
    return (
      <text x={Number(props.x ?? 0) + Number(props.width ?? 0) / 2} y={y} textAnchor="middle" fontSize={12} fill={COLOR.texto}>
        {fila.etiqueta}
      </text>
    );
  };
}
