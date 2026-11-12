import React from 'react';
import { ArrowRight, Building2, GraduationCap, ShieldCheck } from 'lucide-react';
import { PaginaPublica } from './Publico';

interface Tarjeta {
  titulo: string;
  descripcion: string;
  boton: string;
  href: string;
  icono: React.ComponentType<{ className?: string }>;
  /** Clases del color de acento: título, ícono y botón. */
  acento: { texto: string; fondoIcono: string; boton: string };
}

const TARJETAS: Tarjeta[] = [
  {
    titulo: 'Soy titulado',
    descripcion:
      'Cuéntenos sobre su formación de posgrado, su situación laboral y cómo valora la formación que recibió en la Carrera. Toma unos 10 minutos y no necesita una cuenta.',
    boton: 'Llenar encuesta',
    href: '#encuesta-titulados',
    icono: GraduationCap,
    acento: { texto: 'text-institucional', fondoIcono: 'bg-institucional-fondo', boton: 'bg-institucional hover:bg-institucional/90' }
  },
  {
    titulo: 'Soy empleador',
    descripcion:
      'Si en su organización trabajan ingenieros de sistemas de la UMSS, compártanos su opinión sobre su desempeño y las competencias que demanda el mercado. No necesita una cuenta.',
    boton: 'Llenar encuesta',
    href: '#encuesta-empleadores',
    icono: Building2,
    acento: { texto: 'text-resalte-oscuro', fondoIcono: 'bg-resalte-fondo', boton: 'bg-resalte-oscuro hover:bg-resalte-oscuro/90' }
  },
  {
    titulo: 'Administrador',
    descripcion:
      'Acceso al panel de análisis: perfil de los titulados, mercado laboral, pruebas estadísticas, simulación, base de datos y gestión de usuarios.',
    boton: 'Entrar al panel',
    href: '#admin-login',
    icono: ShieldCheck,
    acento: { texto: 'text-slate-800', fondoIcono: 'bg-slate-100', boton: 'bg-slate-800 hover:bg-slate-700' }
  }
];

/** Portada pública: lo primero que se ve, sin iniciar sesión. */
export function PortadaPublica() {
  return (
    <PaginaPublica ancho="max-w-6xl">
      <header className="text-center max-w-3xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 text-balance">Sistema de Análisis de Mercado y Empleabilidad</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-700">Ingeniería de Sistemas — Universidad Mayor de San Simón</p>
        <p className="mt-2 text-sm text-slate-500">Herramienta de recolección y análisis para el proceso de acreditación ARCU-SUR</p>
      </header>

      <ul className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5" aria-label="Opciones de acceso">
        {TARJETAS.map(({ titulo, descripcion, boton, href, icono: Icono, acento }) => (
          <li key={titulo} className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col">
            <span className={`w-11 h-11 rounded-full flex items-center justify-center ${acento.fondoIcono}`}>
              <Icono className={`w-6 h-6 ${acento.texto}`} aria-hidden="true" />
            </span>
            <h2 className={`mt-4 text-lg font-semibold ${acento.texto}`}>{titulo}</h2>
            <p className="mt-2 text-sm text-slate-600 flex-1">{descripcion}</p>
            <a
              href={href}
              className={`mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded ${acento.boton}`}
            >
              {boton}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </PaginaPublica>
  );
}
