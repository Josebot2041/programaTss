import React from 'react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar as RadarRecharts, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { COLOR } from '../../ui/tema';
import { num } from '../../utils/formato';
import { usePantallaAngosta } from './BarrasHorizontales';

export interface PuntoRadar {
  eje: string;
  valor: number;
}

/**
 * Gráfico de araña con una sola serie. Cada eje muestra su valor junto al nombre,
 * así el gráfico se lee sin pasar el cursor.
 */
export function Radar({
  puntos,
  maximo = 100,
  sufijo = '',
  decimales = 1,
  alto = 340
}: {
  puntos: PuntoRadar[];
  maximo?: number;
  sufijo?: string;
  decimales?: number;
  alto?: number;
}) {
  const angosto = usePantallaAngosta();
  const datos = puntos.map((p) => ({ ...p, etiqueta: `${p.eje} (${num(p.valor, decimales)}${sufijo})` }));
  return (
    <ResponsiveContainer width="100%" height={angosto ? alto - 40 : alto}>
      <RadarChart data={datos} outerRadius={angosto ? '48%' : '58%'} margin={{ top: 10, right: 90, bottom: 10, left: 90 }}>
        <PolarGrid stroke={COLOR.grisClaro} />
        <PolarAngleAxis dataKey="etiqueta" tick={{ fontSize: angosto ? 10 : 12, fill: COLOR.texto }} />
        <PolarRadiusAxis domain={[0, maximo]} tickCount={5} tick={false} axisLine={false} />
        <Tooltip formatter={(valor) => [`${num(Number(valor), decimales)}${sufijo}`, 'Valor']} />
        <RadarRecharts dataKey="valor" stroke={COLOR.azul} strokeWidth={2} fill={COLOR.azul} fillOpacity={0.18} isAnimationActive={false} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
