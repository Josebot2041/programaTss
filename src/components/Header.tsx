import React from 'react';
import { LogOut, Menu, Printer } from 'lucide-react';
import type { Usuario } from '../utils/validacionUsuario';
import { NAVEGACION, NAVEGACION_ADMIN } from './Sidebar';

interface HeaderProps {
  activeTab: string;
  onOpenReport: () => void;
  tituladosCount: number;
  empleadoresCount: number;
  onToggleMobileMenu: () => void;
  usuario?: Usuario;
  onCerrarSesion?: () => void;
}

const NOMBRE_ROL = { admin: 'Administrador', usuario: 'Usuario' } as const;

/** Barra superior mínima: ubicación dentro de la navegación, acceso al informe y sesión. */
export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenReport,
  tituladosCount,
  empleadoresCount,
  onToggleMobileMenu,
  usuario,
  onCerrarSesion
}) => {
  const seccion = [...NAVEGACION, NAVEGACION_ADMIN].find((s) => s.items.some((i) => i.id === activeTab));
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
          <span className="hidden xl:inline text-slate-500 tabular-nums">
            {tituladosCount} titulados · {empleadoresCount} empleadores
          </span>
          <button onClick={onOpenReport} className="flex items-center gap-1.5 text-institucional hover:underline">
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Informe</span>
          </button>
          {usuario && (
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="hidden md:block text-right leading-tight" data-testid="usuario-actual">
                <div className="text-slate-900 font-medium max-w-48 truncate">{usuario.nombre_completo}</div>
                <div className="text-xs text-slate-500">{NOMBRE_ROL[usuario.rol]}</div>
              </div>
              <button onClick={onCerrarSesion} className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900" title="Cerrar sesión">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Cerrar sesión</span>
                <span className="sr-only sm:hidden">Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
