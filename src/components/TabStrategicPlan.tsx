import React, { useMemo } from 'react';
import { Printer } from 'lucide-react';
import { Empleador, Titulado } from '../types';
import { calcularResumen, generarFortalezasOportunidades, generarHallazgos, generarPlanAccion } from '../utils/hallazgos';
import { EncabezadoPagina, Panel, Seccion } from './ui/Estructura';

interface TabStrategicPlanProps {
  titulados: Titulado[];
  empleadores: Empleador[];
  onOpenReport: () => void;
}

export const TabStrategicPlan: React.FC<TabStrategicPlanProps> = ({ titulados, empleadores, onOpenReport }) => {
  const resumen = useMemo(() => calcularResumen(titulados, empleadores), [titulados, empleadores]);
  const hallazgos = generarHallazgos(resumen);
  const { fortalezas, oportunidades } = generarFortalezasOportunidades(resumen);
  const plan = generarPlanAccion(resumen);
  const fuente = `encuesta a titulados (n = ${titulados.length}) y a empleadores (n = ${empleadores.length})`;

  return (
    <div className="space-y-10">
      <EncabezadoPagina
        titulo="Plan estratégico"
        descripcion="Hallazgos, fortalezas y acciones propuestas para el Plan de Desarrollo de la Carrera. Las cifras se calculan con la base activa."
        acciones={
          <button
            onClick={onOpenReport}
            className="flex items-center gap-2 px-3 py-2 text-sm text-institucional border border-institucional rounded hover:bg-institucional-fondo"
          >
            <Printer className="w-4 h-4" />
            Informe en PDF
          </button>
        }
      />

      <Seccion titulo="Matriz de hallazgos">
        <Panel titulo="Hallazgos principales y su implicancia" fuente={fuente}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="py-2 pr-3 font-medium w-8">N.º</th>
                  <th className="py-2 px-3 font-medium">Hallazgo</th>
                  <th className="py-2 px-3 font-medium">Evidencia</th>
                  <th className="py-2 pl-3 font-medium">Implicancia</th>
                </tr>
              </thead>
              <tbody>
                {hallazgos.map((h) => (
                  <tr key={h.numero} className="border-b border-slate-100 last:border-0 align-top">
                    <td className="py-2.5 pr-3 text-slate-500 tabular-nums">{h.numero}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{h.hallazgo}</td>
                    <td className="py-2.5 px-3 text-slate-700 tabular-nums">{h.evidencia}</td>
                    <td className="py-2.5 pl-3 text-slate-700">{h.implicancia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Seccion>

      <Seccion titulo="Fortalezas y oportunidades de mejora">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel titulo="Fortalezas" fuente={fuente}>
            <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5 marker:text-slate-400">
              {fortalezas.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Panel>
          <Panel titulo="Oportunidades de mejora" fuente={fuente}>
            <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5 marker:text-slate-400">
              {oportunidades.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </Panel>
        </div>
      </Seccion>

      <Seccion titulo="Plan de acción">
        <Panel titulo="Líneas de acción, indicadores y plazos" fuente="propuesta del informe; la línea base de cada indicador se calcula con la base activa">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="py-2 pr-3 font-medium">Línea</th>
                  <th className="py-2 px-3 font-medium">Acción</th>
                  <th className="py-2 px-3 font-medium">Indicador de seguimiento</th>
                  <th className="py-2 pl-3 font-medium whitespace-nowrap">Plazo</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((a) => (
                  <tr key={a.linea} className="border-b border-slate-100 last:border-0 align-top">
                    <td className="py-2.5 pr-3 font-medium text-slate-900 whitespace-nowrap">{a.linea}</td>
                    <td className="py-2.5 px-3 text-slate-700">{a.accion}</td>
                    <td className="py-2.5 px-3 text-slate-700 tabular-nums">{a.indicador}</td>
                    <td className="py-2.5 pl-3 text-slate-700 whitespace-nowrap">{a.plazo}</td>
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
