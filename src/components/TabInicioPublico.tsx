// src/components/TabInicioPublico.tsx
import React from 'react';
import { GraduationCap, Building2, Lock } from 'lucide-react';

export const TabInicioPublico = ({ onLogin }: { onLogin: () => void }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">Herramienta de Colección de Datos</h1>
        <p className="text-slate-600">Proceso de Acreditación ARCUSUR - Ingeniería de Sistemas (UMSS)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
        {/* Botón Titulados */}
        <a 
          href="#encuesta_titulados"
          className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-400 transition text-center group"
        >
          <GraduationCap className="w-16 h-16 text-blue-600 mx-auto mb-4 group-hover:scale-110 transition" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Soy Titulado</h2>
          <p className="text-sm text-slate-500">Llena la encuesta de empleabilidad y formación.</p>
        </a>

        {/* Botón Empleadores */}
        <a 
          href="#encuesta_empleadores"
          className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-emerald-400 transition text-center group"
        >
          <Building2 className="w-16 h-16 text-emerald-600 mx-auto mb-4 group-hover:scale-110 transition" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Soy Empleador</h2>
          <p className="text-sm text-slate-500">Completa la encuesta sobre el perfil profesional.</p>
        </a>
      </div>

      {/* Acceso Administrativo */}
      <div className="mt-16">
        <button 
          onClick={onLogin}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-700 text-sm transition"
        >
          <Lock className="w-4 h-4" /> Acceso Administrativo
        </button>
      </div>
    </div>
  );
};