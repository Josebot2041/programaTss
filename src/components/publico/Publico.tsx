/**
 * Piezas comunes de las páginas públicas (portada, encuestas y acceso de administrador).
 */

import React from 'react';
import { ArrowLeft } from 'lucide-react';

export const PIE_INSTITUCIONAL = 'Universidad Mayor de San Simón — Facultad de Ciencias y Tecnología';

/** Enlace «← Volver al inicio»: es un enlace real (se puede abrir en otra pestaña), pero navega sin recargar. */
export function VolverAlInicio({ onVolver }: { onVolver: () => void }) {
  return (
    <a
      href={typeof window === 'undefined' ? '/' : window.location.pathname}
      onClick={(e) => {
        e.preventDefault();
        onVolver();
      }}
      className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-institucional hover:underline"
    >
      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
      Volver al inicio
    </a>
  );
}

/** Marco de una página pública: fondo, contenido centrado y pie institucional. */
export function PaginaPublica({ children, ancho = 'max-w-4xl' }: { children: React.ReactNode; ancho?: string }) {
  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased flex flex-col">
      <main className={`flex-1 w-full ${ancho} mx-auto px-4 sm:px-6 py-8 sm:py-12`}>{children}</main>
      <footer className="border-t border-slate-200 bg-white py-5 px-4 text-center text-xs text-slate-500">{PIE_INSTITUCIONAL}</footer>
    </div>
  );
}
