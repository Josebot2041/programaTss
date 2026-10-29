import React from 'react';
import { CloudOff, Database, FileSpreadsheet, LogOut, Menu, Printer } from 'lucide-react';
import type { Usuario } from '../utils/validacionUsuario';
import { NAVEGACION, NAVEGACION_ADMIN } from './Sidebar';

/** De dónde vienen los datos a la vista: PostgreSQL, el Excel de respaldo o un archivo importado. */
export type FuenteDatos = 'api' | 'excel' | 'archivo';

interface HeaderProps {
  activeTab: string;
  onOpenReport: () => void;
  tituladosCount: number;
  empleadoresCount: number;
  onToggleMobileMenu: () => void;
  usuario?: Usuario;
  onCerrarSesion?: () => void;
  fuente?: FuenteDatos;
  /** false si la última recarga falló y los datos de la base pueden estar atrasados. */
  alDia?: boolean;
  recargando?: boolean;
  onReintentar?: () => void;
}

const NOMBRE_ROL = { admin: 'Administrador', usuario: 'Usuario' } as const;

/**
 * Fuente de datos activa. Fuera de la base (o con la base sin actualizar) se ve en naranja con
 * «Reintentar», para que el respaldo Excel nunca pase inadvertido.
 */
function IndicadorFuente({
  fuente,
  alDia,
  recargando,
  tituladosCount,
  empleadoresCount,
  onReintentar
}: Required<Pick<HeaderProps, 'fuente' | 'alDia' | 'recargando' | 'tituladosCount' | 'empleadoresCount'>> & Pick<HeaderProps, 'onReintentar'>) {
  const aviso = fuente !== 'api' || !alDia;
  const Icono = fuente === 'api' ? Database : fuente === 'excel' ? CloudOff : FileSpreadsheet;
  const [texto, corto] =
    fuente === 'excel'
      ? ['Respaldo Excel (sin conexión)', 'Respaldo Excel']
      : fuente === 'archivo'
        ? [`Archivo importado · ${tituladosCount} titulados`, 'Archivo']
        : [`Base de datos · ${tituladosCount} titulados${alDia ? '' : ' (sin actualizar)'}`, `${tituladosCount}`];

  return (
    <div role="status" data-testid="fuente-datos" className="flex items-center gap-2 min-w-0">
      <span
        title={texto}
        className={`flex items-center gap-1.5 tabular-nums ${
          aviso ? 'rounded border border-resalte/40 bg-resalte-fondo px-2 py-0.5 font-medium text-orange-800' : 'text-slate-600'
        }`}
      >
        <Icono className={`w-4 h-4 shrink-0 ${aviso ? 'text-resalte' : 'text-institucional'}`} aria-hidden="true" />
        <span className="hidden sm:inline">
          {texto}
          {fuente === 'api' && alDia && <span className="hidden xl:inline text-slate-500"> · {empleadoresCount} empleadores</span>}
        </span>
        <span className="sm:hidden" aria-hidden="true">
          {corto}
        </span>
        <span className="sr-only sm:hidden">{texto}</span>
      </span>
      {aviso && onReintentar && (
        <button onClick={onReintentar} disabled={recargando} className="text-institucional hover:underline disabled:opacity-60 disabled:no-underline">
          {recargando ? 'Reintentando…' : fuente === 'archivo' ? 'Volver a la base' : 'Reintentar'}
        </button>
      )}
    </div>
  );
}

/** Barra superior mínima: ubicación dentro de la navegación, acceso al informe y sesión. */
export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenReport,
  tituladosCount,
  empleadoresCount,
  onToggleMobileMenu,
  usuario,
  onCerrarSesion,
  fuente = 'api',
  alDia = true,
  recargando = false,
  onReintentar
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
          <IndicadorFuente
            fuente={fuente}
            alDia={alDia}
            recargando={recargando}
            tituladosCount={tituladosCount}
            empleadoresCount={empleadoresCount}
            onReintentar={onReintentar}
          />
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
