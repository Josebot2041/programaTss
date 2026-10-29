import React from 'react';
import { ArrowRight } from 'lucide-react';
import { NAVEGACION } from '../Sidebar';
import { EncabezadoPagina } from '../ui/Estructura';

/** Qué muestra cada pestaña de estadísticas y gráficos. */
const DESCRIPCIONES: Record<string, string> = {
  titulados: 'Vida profesional por segmento (junior y consolidado), su distribución y el perfil general.',
  mercado: 'Situación laboral, tiempo para el primer empleo y remuneración según sector.',
  curriculo: 'Valoración del plan de estudios por titulados y empleadores, y aspectos de la formación.',
  estadistica: 'Pruebas chi-cuadrado de independencia, con frecuencias observadas y esperadas.',
  simulacion: 'Escenarios de decisión simulados (nuevos posgrados, convenios de becas) con IC 95 %.',
  estrategia: 'Matriz de hallazgos, fortalezas y oportunidades de mejora, e informe en PDF.'
};

const GRUPOS = ['Análisis', 'Simulación', 'Resumen'];

/** Acceso directo a las pestañas de estadísticas y gráficos existentes. */
export function AccesosDashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const accesos = GRUPOS.flatMap((g) => NAVEGACION.find((s) => s.group === g)?.items ?? []).filter((i) => i.id in DESCRIPCIONES);
  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo="Dashboard" descripcion="Acceso directo a las estadísticas y gráficos del estudio, calculados con los datos actuales de la base." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accesos.map((item) => {
          const Icono = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="group text-left bg-white border border-slate-200 rounded-md p-5 hover:border-institucional focus:outline-none focus:ring-1 focus:ring-institucional"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Icono className="w-4 h-4 text-institucional" />
                {item.label}
              </div>
              <p className="mt-2 text-sm text-slate-600">{DESCRIPCIONES[item.id]}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm text-institucional group-hover:underline">
                Abrir <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
