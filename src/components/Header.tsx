import React from 'react';
import { Menu, Printer } from 'lucide-react';
import { NAVEGACION } from './Sidebar';

interface HeaderProps {
  activeTab: string;
  onOpenReport: () => void;
  tituladosCount: number;
  empleadoresCount: number;
  onToggleMobileMenu: () => void;
}

/** Barra superior mínima: ubicación dentro de la navegación y acceso al informe. */
export const Header: React.FC<HeaderProps> = ({ activeTab, onOpenReport, tituladosCount, empleadoresCount, onToggleMobileMenu }) => {
  const seccion = NAVEGACION.find((s) => s.items.some((i) => i.id === activeTab));
  const pagina = seccion?.items.find((i) => i.id === activeTab);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 print:hidden">
      <div className="px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0 text-sm">
          <button
            onClick={onToggleMobileMenu}
            className="p-1.5 -ml-1.5 text-slate-600 hover:text-slate-900 lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-slate-500 hidden sm:inline">{seccion?.group ?? 'Resumen'}</span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <span className="text-slate-900 font-medium truncate">{pagina?.label ?? 'Portada'}</span>
        </div>

        <div className="flex items-center gap-4 shrink-0 text-sm">
          <span className="hidden md:inline text-slate-500 tabular-nums">
            {tituladosCount} titulados · {empleadoresCount} empleadores
          </span>
          <button onClick={onOpenReport} className="flex items-center gap-1.5 text-institucional hover:underline">
            <Printer className="w-4 h-4" />
            <span>Informe</span>
          </button>
        </div>
      </div>
    </header>
  );
};
