import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { COLOR, EJE } from '../../ui/tema';
import { pct } from '../../utils/formato';

export interface SerieAgrupada {
  clave: string;
  nombre: string;
  color: string;
}

/** Columnas agrupadas: una categoría por grupo y una barra por serie (valores en porcentaje). */
export function BarrasAgrupadas({
  datos,
  series,
  alto = 280
}: {
  datos: Array<Record<string, string | number>>;
  series: SerieAgrupada[];
  alto?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={COLOR.grisClaro} />
        <XAxis dataKey="categoria" tick={EJE.tick} tickLine={false} axisLine={{ stroke: COLOR.gris }} interval={0} />
        <YAxis tickFormatter={(v) => `${v}%`} tick={EJE.tick} tickLine={false} axisLine={false} width={40} />
        <Tooltip cursor={{ fill: COLOR.grisClaro, opacity: 0.4 }} formatter={(v, nombre) => [pct(Number(v)), String(nombre)]} />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: COLOR.textoSecundario }} />
        {series.map((s) => (
          <Bar key={s.clave} dataKey={s.clave} name={s.nombre} fill={s.color} isAnimationActive={false} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
