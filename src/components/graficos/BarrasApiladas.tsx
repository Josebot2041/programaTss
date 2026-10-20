import React from 'react';
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { COLOR, EJE } from '../../ui/tema';
import { pct } from '../../utils/formato';
import { usePantallaAngosta } from './BarrasHorizontales';

export interface SerieApilada {
  clave: string;
  nombre: string;
  color: string;
  /** Color del texto dentro del segmento. */
  colorTexto?: string;
}

export interface FilaApilada {
  categoria: string;
  /** Conteos por serie (misma clave que `SerieApilada.clave`). */
  conteos: Record<string, number>;
}

/**
 * Barras horizontales apiladas al 100 %: cada fila muestra la distribución de sus respuestas.
 * Los segmentos de al menos 8 % muestran su porcentaje.
 */
export function BarrasApiladas({
  filas,
  series,
  anchoEtiquetas = 200
}: {
  filas: FilaApilada[];
  series: SerieApilada[];
  anchoEtiquetas?: number;
}) {
  const angosto = usePantallaAngosta();
  const datos = filas.map((f) => {
    const total = series.reduce((s, serie) => s + (f.conteos[serie.clave] ?? 0), 0);
    const fila: Record<string, string | number> = { categoria: f.categoria, total };
    for (const serie of series) fila[serie.clave] = total > 0 ? (100 * (f.conteos[serie.clave] ?? 0)) / total : 0;
    return fila;
  });
  return (
    <div>
      <ResponsiveContainer width="100%" height={datos.length * (angosto ? 44 : 32) + 10}>
        <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap={6}>
          <XAxis type="number" hide domain={[0, 100]} />
          <YAxis
            type="category"
            dataKey="categoria"
            width={angosto ? Math.min(anchoEtiquetas, 120) : anchoEtiquetas}
            tick={EJE.tickCategoria}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: COLOR.grisClaro, opacity: 0.4 }}
            formatter={(valor, nombre) => [pct(Number(valor)), String(nombre)]}
          />
          {series.map((serie) => (
            <Bar key={serie.clave} dataKey={serie.clave} name={serie.nombre} stackId="total" fill={serie.color} isAnimationActive={false}>
              <LabelList
                dataKey={serie.clave}
                content={(props) => {
                  const valor = Number(props.value ?? 0);
                  const ancho = Number(props.width ?? 0);
                  if (valor < 8 || ancho < 28) return null;
                  return (
                    <text
                      x={Number(props.x ?? 0) + ancho / 2}
                      y={Number(props.y ?? 0) + Number(props.height ?? 0) / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={11}
                      fill={serie.colorTexto ?? '#FFFFFF'}
                    >
                      {Math.round(valor)}%
                    </text>
                  );
                }}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
        {series.map((s) => (
          <span key={s.clave} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3" style={{ backgroundColor: s.color }} />
            {s.nombre}
          </span>
        ))}
      </div>
    </div>
  );
}
