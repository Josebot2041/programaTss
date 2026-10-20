import React, { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { Empleador, Titulado } from '../types';
import { INFO_INSTITUCIONAL } from '../data/strategicPlan';
import { calcularResumen, generarHallazgos } from '../utils/hallazgos';
import { num, numOrden, pct } from '../utils/formato';
import { EncabezadoPagina, Kpi, Panel, Seccion } from './ui/Estructura';

interface TabOverviewProps {
  titulados: Titulado[];
  empleadores: Empleador[];
  onNavigate: (tab: string) => void;
}

/** Hallazgos que se muestran en la portada y la pestaña donde se analizan. */
const HALLAZGOS_PORTADA: Array<{ numero: number; pestana: string }> = [
  { numero: 1, pestana: 'mercado' },
  { numero: 4, pestana: 'estadistica' },
  { numero: 5, pestana: 'titulados' },
  { numero: 7, pestana: 'titulados' },
  { numero: 8, pestana: 'curriculo' },
  { numero: 9, pestana: 'curriculo' }
];

export const TabOverview: React.FC<TabOverviewProps> = ({ titulados, empleadores, onNavigate }) => {
  const r = useMemo(() => calcularResumen(titulados, empleadores), [titulados, empleadores]);
  const hallazgos = generarHallazgos(r);
  const areaPrincipal = r.ordenar(r.posgrado.areas.filas)[0];
  const propios = r.posgrado.financiamientos.filas.find((f) => f.categoria === 'Recursos propios');
  const pertinencia = r.valoracion.find((v) => v.campo === 'pertinencia_labores')?.estadisticos;
  const vinculacion = r.dimensiones[2];

  const criterios = [
    {
      criterio: 'Pertinencia del perfil',
      evidencia: `${pct(pertinencia?.porcentajeAcuerdo)} realiza labores pertinentes a su formación; ${pct(r.desacuerdoConcordancia)} percibe desfase con el mercado.`,
      pestana: 'curriculo'
    },
    {
      criterio: 'Seguimiento de graduados',
      evidencia: `${pct(r.mercado.insercionRapida.porcentaje)} consigue empleo en 4 meses o menos; la mediana de vida profesional es de ${numOrden(r.vida.general?.mediana)} años.`,
      pestana: 'titulados'
    },
    {
      criterio: 'Relación con el sector productivo',
      evidencia: `Índice de confianza de los empleadores ${num(r.dimensiones[0]?.indice, 1)}; ${pct(r.nuncaConsultados)} nunca fue consultado en la autoevaluación.`,
      pestana: 'mercado'
    },
    {
      criterio: 'Mejora continua',
      evidencia: 'Escenarios de simulación sobre nuevos posgrados, convenios de becas y pasantías.',
      pestana: 'simulacion'
    }
  ];

  return (
    <div className="space-y-10">
      <div>
        <EncabezadoPagina
          titulo="Análisis de mercado de Ingeniería de Sistemas"
          descripcion={`Perfil, formación y empleabilidad de ${titulados.length} titulados y ${empleadores.length} empleadores, como insumo para la autoevaluación ARCU-SUR.`}
        />
        <p className="mt-3 text-xs text-slate-500">
          {INFO_INSTITUCIONAL.universidad} · {INFO_INSTITUCIONAL.facultad} · {INFO_INSTITUCIONAL.materia} · {INFO_INSTITUCIONAL.grupo} ·{' '}
          {INFO_INSTITUCIONAL.fecha}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi valor={pct(r.mercado.ocupacion.porcentaje)} etiqueta="Tasa de ocupación" contexto={`${r.mercado.ocupacion.n} de ${r.mercado.ocupacion.total} trabaja o emprende`} />
        <Kpi valor={pct(r.mercado.yaTrabajaba.porcentaje)} etiqueta="Ya trabajaba al titularse" contexto={`${r.mercado.yaTrabajaba.n} de ${r.mercado.yaTrabajaba.total}`} />
        <Kpi valor={pct(r.posgrado.interesados.porcentaje)} etiqueta="Interés en un posgrado" contexto={`${r.posgrado.interesados.n} de ${r.posgrado.interesados.total}`} />
        <Kpi
          valor={pct(areaPrincipal?.porcentaje)}
          etiqueta={`Prefiere ${areaPrincipal?.categoria ?? '—'}`}
          contexto="área de posgrado más elegida"
        />
        <Kpi valor={pct(propios?.porcentaje)} etiqueta="Pagó su posgrado con recursos propios" contexto={`${propios?.n ?? 0} de ${r.posgrado.financiamientos.total}`} />
        <Kpi valor={num(vinculacion?.indice, 1)} etiqueta="Vinculación con empleadores" contexto="índice de 0 a 100" />
      </div>

      <Seccion titulo="Hallazgos principales">
        <ul className="bg-white border border-slate-200 rounded-md divide-y divide-slate-100">
          {HALLAZGOS_PORTADA.map(({ numero, pestana }) => {
            const h = hallazgos.find((x) => x.numero === numero);
            if (!h) return null;
            return (
              <li key={numero} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6">
                <span className="sm:w-80 shrink-0 text-sm font-medium text-slate-900">{h.hallazgo}</span>
                <span className="flex-1 text-sm text-slate-700 tabular-nums">{h.evidencia}</span>
                <button onClick={() => onNavigate(pestana)} className="shrink-0 text-sm text-institucional hover:underline inline-flex items-center gap-1 self-start">
                  Ver análisis <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      </Seccion>

      <Seccion titulo="Criterios ARCU-SUR" descripcion="Evidencia de este estudio para cada criterio de acreditación.">
        <Panel titulo="Criterios y evidencia" fuente={`encuesta a titulados (n = ${titulados.length}) y a empleadores (n = ${empleadores.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {criterios.map((c) => (
                  <tr key={c.criterio} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-slate-900 whitespace-nowrap align-top">{c.criterio}</td>
                    <td className="py-2.5 px-4 text-slate-700">{c.evidencia}</td>
                    <td className="py-2.5 pl-4 text-right align-top">
                      <button onClick={() => onNavigate(c.pestana)} className="text-institucional hover:underline whitespace-nowrap">
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Seccion>
    </div>
  );
};
