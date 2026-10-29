/**
 * Controles de formulario compartidos. Todos empiezan sin valor y muestran su error debajo.
 */
import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const claseControl = (error?: string) =>
  `w-full border rounded px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-institucional ${
    error ? 'border-resalte' : 'border-slate-300'
  }`;

function Etiqueta({ id, texto, obligatorio, error, children }: { id: string; texto: string; obligatorio?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-slate-700 mb-1">
        {texto}
        {obligatorio && <span className="text-resalte"> *</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-resalte">
          {error}
        </p>
      )}
    </div>
  );
}

export function CampoSelect<T extends string>({
  id,
  etiqueta,
  valor,
  opciones,
  onCambiar,
  error,
  obligatorio = true
}: {
  id: string;
  etiqueta: string;
  valor: T | '';
  opciones: readonly T[];
  onCambiar: (v: T | '') => void;
  error?: string;
  obligatorio?: boolean;
}) {
  return (
    <Etiqueta id={id} texto={etiqueta} obligatorio={obligatorio} error={error}>
      <select
        id={id}
        value={valor}
        onChange={(e) => onCambiar(e.target.value as T | '')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={claseControl(error)}
      >
        <option value="">Seleccione…</option>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Etiqueta>
  );
}

export function CampoTexto({
  id,
  etiqueta,
  valor,
  onCambiar,
  error,
  obligatorio = false,
  tipo = 'text',
  ayuda,
  multilinea = false,
  autoComplete
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onCambiar: (v: string) => void;
  error?: string;
  obligatorio?: boolean;
  tipo?: 'text' | 'number';
  ayuda?: string;
  multilinea?: boolean;
  autoComplete?: string;
}) {
  const comunes = {
    id,
    autoComplete,
    value: valor,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
    className: claseControl(error)
  };
  return (
    <Etiqueta id={id} texto={etiqueta} obligatorio={obligatorio} error={error}>
      {multilinea ? (
        <textarea {...comunes} rows={2} onChange={(e) => onCambiar(e.target.value)} />
      ) : (
        <input {...comunes} type={tipo} step={tipo === 'number' ? 'any' : undefined} min={tipo === 'number' ? 0 : undefined} onChange={(e) => onCambiar(e.target.value)} />
      )}
      {ayuda && !error && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>}
    </Etiqueta>
  );
}

/** Contraseña con un botón para mostrarla u ocultarla. */
export function CampoContrasena({
  id,
  etiqueta,
  valor,
  onCambiar,
  error,
  ayuda,
  autoComplete
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onCambiar: (v: string) => void;
  error?: string;
  ayuda?: string;
  autoComplete: 'current-password' | 'new-password';
}) {
  const [visible, setVisible] = useState(false);
  const descripcion = error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined;
  return (
    <Etiqueta id={id} texto={etiqueta} obligatorio error={error}>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={valor}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={descripcion}
          onChange={(e) => onCambiar(e.target.value)}
          className={`${claseControl(error)} pr-10`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 px-2.5 flex items-center text-slate-500 hover:text-slate-800"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {ayuda && !error && (
        <p id={`${id}-ayuda`} className="mt-1 text-xs text-slate-500">
          {ayuda}
        </p>
      )}
    </Etiqueta>
  );
}

/** Pregunta con opciones excluyentes en botones (escalas Likert). */
export function CampoOpciones<T extends string | number>({
  etiqueta,
  valor,
  opciones,
  onCambiar,
  error
}: {
  etiqueta: string;
  valor: T | '';
  opciones: Array<{ valor: T; texto: string }>;
  onCambiar: (v: T) => void;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm text-slate-700 mb-1.5">
        {etiqueta}
        <span className="text-resalte"> *</span>
      </legend>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {opciones.map((o) => (
          <button
            key={String(o.valor)}
            type="button"
            role="radio"
            aria-checked={valor === o.valor}
            onClick={() => onCambiar(o.valor)}
            className={`px-2 py-1.5 text-xs rounded border ${
              valor === o.valor ? 'bg-institucional text-white border-institucional' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-resalte">{error}</p>}
    </fieldset>
  );
}

export function CampoCasillas<T extends string>({
  etiqueta,
  opciones,
  seleccion,
  onCambiar
}: {
  etiqueta: string;
  opciones: readonly T[];
  seleccion: T[];
  onCambiar: (v: T[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm text-slate-700 mb-1.5">{etiqueta}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {opciones.map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={seleccion.includes(o)}
              onChange={() => onCambiar(seleccion.includes(o) ? seleccion.filter((x) => x !== o) : [...seleccion, o])}
            />
            {o}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Bloque de un formulario con título. */
export function GrupoFormulario({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-md p-5 space-y-4">
      <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
      {children}
    </section>
  );
}
