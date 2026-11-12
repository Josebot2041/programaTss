/**
 * Piezas comunes de las páginas públicas (portada, encuestas y acceso de administrador).
 */

import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { apiDisponible } from '../../utils/api';

export const PIE_INSTITUCIONAL = 'Universidad Mayor de San Simón — Facultad de Ciencias y Tecnología';

export type EstadoApi = 'verificando' | 'disponible' | 'no_disponible';

/**
 * Consulta GET /api/health (hasta 3 s) al abrir una página pública. Sin la API (por ejemplo, un
 * despliegue solo estático) las encuestas y el login no pueden funcionar, así que las páginas
 * lo avisan y deshabilitan sus botones. Mientras se verifica, todo sigue habilitado.
 */
export function useEstadoApi(): EstadoApi {
  const [estado, setEstado] = useState<EstadoApi>('verificando');
  useEffect(() => {
    let vigente = true;
    void apiDisponible().then((ok) => {
      if (vigente) setEstado(ok ? 'disponible' : 'no_disponible');
    });
    return () => {
      vigente = false;
    };
  }, []);
  return estado;
}

/** Aviso sobrio de que el servidor no está disponible. */
export function AvisoNoDisponible({ children = 'Las encuestas no están disponibles en este momento.' }: { children?: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 border-l-4 border-resalte bg-resalte-fondo px-4 py-3 text-sm text-slate-800">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-resalte" aria-hidden="true" />
      <span>{children} Intente de nuevo más tarde.</span>
    </div>
  );
}

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
