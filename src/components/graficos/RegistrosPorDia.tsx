import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { COLOR, EJE } from '../../ui/tema';

export interface DiaRegistros {
  /** AAAA-MM-DD */
  fecha: string;
  titulados: number;
  empleadores: number;
}

const SERIES = [
  { clave: 'titulados', nombre: 'Titulados', color: COLOR.azul },
  { clave: 'empleadores', nombre: 'Empleadores', color: COLOR.azulMedio }
] as const;

/** "2026-10-29" → "jue 29/10" (la fecha se interpreta sin zona horaria). */
export function etiquetaDia(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).toLocaleDateString('es-BO', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
  return `${dia} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/**
 * Encuestas registradas por día (barras apiladas de titulados y empleadores), con leyenda y
 * la misma información en una tabla debajo.
 */
export function RegistrosPorDia({ dias }: { dias: DiaRegistros[] }) {
  const datos = dias.map((d) => ({ ...d, dia: etiquetaDia(d.fecha) }));
  const maximo = Math.max(1, ...dias.map((d) => d.titulados + d.empleadores));
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
        {SERIES.map((s) => (
          <span key={s.clave} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.nombre}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={datos} margin={{ top: 4, right: 8, bottom: 0, left: -16 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={COLOR.grisClaro} />
          <XAxis dataKey="dia" tick={EJE.tick} axisLine={{ stroke: COLOR.grisClaro }} tickLine={false} interval={0} />
          <YAxis allowDecimals={false} domain={[0, maximo]} tick={EJE.tick} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: COLOR.grisClaro, opacity: 0.4 }}
            formatter={(valor, nombre) => [String(valor), String(nombre)]}
            labelStyle={{ color: COLOR.texto, fontWeight: 600 }}
          />
          {SERIES.map((s, i) => (
            <Bar
              key={s.clave}
              dataKey={s.clave}
              name={s.nombre}
              stackId="dia"
              fill={s.color}
              stroke="#FFFFFF"
              strokeWidth={2}
              maxBarSize={36}
              radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <table className="mt-4 w-full text-xs text-left tabular-nums">
        <caption className="sr-only">Encuestas registradas por día</caption>
        <thead className="text-slate-500 border-b border-slate-200">
          <tr>
            <th className="py-1.5 font-medium">Día</th>
            <th className="py-1.5 font-medium text-right">Titulados</th>
            <th className="py-1.5 font-medium text-right">Empleadores</th>
            <th className="py-1.5 font-medium text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {datos.map((d) => (
            <tr key={d.fecha}>
              <td className="py-1.5">{d.dia}</td>
              <td className="py-1.5 text-right">{d.titulados}</td>
              <td className="py-1.5 text-right">{d.empleadores}</td>
              <td className="py-1.5 text-right font-medium text-slate-900">{d.titulados + d.empleadores}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
