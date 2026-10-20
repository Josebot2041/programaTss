import React from 'react';
import type { TablaCruzada } from '../../utils/estadistica';

/** Mezcla lineal entre dos colores hexadecimales (t de 0 a 1). */
function mezclar(desde: string, hasta: string, t: number): string {
  const a = desde.match(/\w\w/g)?.map((h) => parseInt(h, 16)) ?? [0, 0, 0];
  const b = hasta.match(/\w\w/g)?.map((h) => parseInt(h, 16)) ?? [0, 0, 0];
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

const CLARO = '#EEF3F8';
const OSCURO = '#1F4E79';

/**
 * Mapa de calor de una tabla cruzada: la intensidad del azul es proporcional a la frecuencia.
 * Se construye como tabla HTML (Recharts no tiene este tipo de gráfico), así se lee y se imprime bien.
 */
export function MapaCalor({
  tabla,
  etiquetaFilas,
  nombreFila = (f: string) => f
}: {
  tabla: TablaCruzada;
  etiquetaFilas: string;
  nombreFila?: (fila: string) => string;
}) {
  const maximo = Math.max(1, ...tabla.observadas.flat());
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr className="text-slate-600">
            <th className="py-1.5 pr-3 text-left font-medium">{etiquetaFilas}</th>
            {tabla.columnas.map((c) => (
              <th key={c} className="py-1.5 px-2 text-center font-medium">
                {c}
              </th>
            ))}
            <th className="py-1.5 pl-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {tabla.filas.map((fila, i) => (
            <tr key={fila}>
              <td className="py-2 pr-3 text-slate-900 whitespace-nowrap">{nombreFila(fila)}</td>
              {tabla.observadas[i].map((v, j) => {
                const t = v / maximo;
                return (
                  <td
                    key={tabla.columnas[j]}
                    className="py-2 px-2 text-center"
                    style={{ backgroundColor: mezclar(CLARO, OSCURO, t), color: t > 0.55 ? '#FFFFFF' : '#1F2937' }}
                  >
                    {v}
                  </td>
                );
              })}
              <td className="py-2 pl-2 text-right text-slate-600">{tabla.totalesFila[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
        <span className="mr-1">0</span>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <span key={t} className="inline-block h-3 w-5" style={{ backgroundColor: mezclar(CLARO, OSCURO, t) }} />
        ))}
        <span className="ml-1">{maximo}</span>
      </div>
    </div>
  );
}
