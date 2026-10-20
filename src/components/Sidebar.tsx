import React from 'react';
import {
  BarChart3,
  Briefcase,
  Building2,
  Cpu,
  Database,
  FileText,
  GraduationCap,
  Home,
  Layers,
  Printer,
  UserCheck,
  X
} from 'lucide-react';
import { INFO_INSTITUCIONAL } from '../data/strategicPlan';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  group: string;
  items: NavItem[];
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenReport: () => void;
  tituladosCount: number;
  empleadoresCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

/** Navegación principal: etiquetas de 2 a 4 palabras, agrupadas por propósito. */
export const NAVEGACION: NavSection[] = [
  {
    group: 'Resumen',
    items: [
      { id: 'overview', label: 'Portada', icon: Home },
      { id: 'estrategia', label: 'Plan estratégico', icon: FileText }
    ]
  },
  {
    group: 'Análisis',
    items: [
      { id: 'titulados', label: 'Perfil de los titulados', icon: GraduationCap },
      { id: 'mercado', label: 'Mercado laboral', icon: Briefcase },
      { id: 'curriculo', label: 'Plan de estudios', icon: Layers },
      { id: 'estadistica', label: 'Pruebas de independencia', icon: BarChart3 }
    ]
  },
  {
    group: 'Simulación',
    items: [{ id: 'simulacion', label: 'Escenarios de decisión', icon: Cpu }]
  },
  {
    group: 'Datos',
    items: [
      { id: 'encuesta_titulados', label: 'Encuesta a titulados', icon: UserCheck },
      { id: 'encuesta_empleadores', label: 'Encuesta a empleadores', icon: Building2 },
      { id: 'encuestas', label: 'Base de datos', icon: Database }
    ]
  }
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenReport,
  tituladosCount,
  empleadoresCount,
  isOpenMobile,
  onCloseMobile
}) => {
  const seleccionar = (id: string) => {
    setActiveTab(id);
    onCloseMobile();
  };

  return (
    <>
      {isOpenMobile && <div onClick={onCloseMobile} className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" />}

      <aside
        className={`print:hidden fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Ingeniería de Sistemas</div>
            <div className="text-xs text-slate-500">UMSS · Análisis de mercado</div>
          </div>
          <button onClick={onCloseMobile} className="p-1 text-slate-400 hover:text-slate-700 lg:hidden" aria-label="Cerrar menú">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Secciones">
          {NAVEGACION.map((seccion) => (
            <div key={seccion.group}>
              <div className="px-2 mb-1 text-xs font-medium text-slate-500">{seccion.group}</div>
              <ul className="space-y-0.5">
                {seccion.items.map((item) => {
                  const Icon = item.icon;
                  const activo = activeTab === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => seleccionar(item.id)}
                        aria-current={activo ? 'page' : undefined}
                        className={`w-full flex items-center gap-2.5 px-2 py-2 rounded text-sm text-left border-l-2 ${
                          activo
                            ? 'border-institucional bg-institucional-fondo text-institucional font-medium'
                            : 'border-transparent text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${activo ? 'text-institucional' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-200 space-y-3">
          <button
            onClick={() => {
              onOpenReport();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-institucional border border-institucional rounded hover:bg-institucional-fondo"
          >
            <Printer className="w-4 h-4" />
            Informe en PDF
          </button>
          <div className="text-xs text-slate-500">
            {tituladosCount} titulados · {empleadoresCount} empleadores
            <br />
            {INFO_INSTITUCIONAL.grupo} · {INFO_INSTITUCIONAL.fecha}
          </div>
        </div>
      </aside>
    </>
  );
};
