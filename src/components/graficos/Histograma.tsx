import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { COLOR, EJE } from '../../ui/tema';
import type { Intervalo } from '../../utils/estadistica';
import { num } from '../../utils/formato';

/**
 * Histograma con eje numérico (las líneas de referencia caen en su valor exacto).
 * `colorDe` decide el color de cada intervalo (por ejemplo, según el segmento).
 * Las líneas de referencia no llevan texto sobre el gráfico (se superponen cuando están
 * cerca): se identifican en la leyenda del panel.
 */
export function Histograma({
  intervalos,
  colorDe,
  referencias = [],
  etiquetaX,
  alto = 260
}: {
  intervalos: Intervalo[];
  colorDe: (intervalo: Intervalo) => string;
  referencias?: Array<{ valor: number; texto: string; color: string }>;
  etiquetaX: string;
  alto?: number;
}) {
  const datos = intervalos.map((i) => ({ ...i, centro: (i.desde + i.hasta) / 2 }));
  const fin = intervalos.length > 0 ? intervalos[intervalos.length - 1].hasta : 1;
  const marcas = Array.from({ length: Math.floor(fin / 5) + 1 }, (_, k) => k * 5);
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={datos} margin={{ top: 8, right: 12, bottom: 20, left: 0 }} barCategoryGap={1}>
        <CartesianGrid vertical={false} stroke={COLOR.grisClaro} />
        <XAxis
          type="number"
          dataKey="centro"
          domain={[0, fin]}
          ticks={marcas}
          tick={EJE.tick}
          tickLine={false}
          axisLine={{ stroke: COLOR.gris }}
          label={{ value: etiquetaX, position: 'insideBottom', offset: -12, fontSize: 12, fill: COLOR.textoSecundario }}
        />
        <YAxis allowDecimals={false} tick={EJE.tick} tickLine={false} axisLine={false} width={32} />
        <Tooltip
          cursor={{ fill: COLOR.grisClaro, opacity: 0.5 }}
          formatter={(valor) => [String(valor), 'Titulados']}
          labelFormatter={(_, carga) => {
            const i = carga?.[0]?.payload as Intervalo | undefined;
            return i ? `${num(i.desde, 0)} a menos de ${num(i.hasta, 0)} años` : '';
          }}
        />
        <Bar dataKey="n" isAnimationActive={false}>
          {datos.map((d) => (
            <Cell key={d.desde} fill={colorDe(d)} />
          ))}
        </Bar>
        {referencias.map((r) => (
          <ReferenceLine key={r.texto} x={r.valor} stroke={r.color} strokeWidth={1.5} strokeDasharray="4 3" />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
