import React, { useState } from 'react';
import { Empleador } from '../types';
import { AFIRMACIONES_EMPLEADORES, DIMENSIONES_EMPLEADORES } from '../data/strategicPlan';
import {
  CARGOS_EMPLEADOR,
  LIKERT_EMPLEADOR,
  MEDIOS_CONVOCATORIA,
  NIVELES_DEMANDADOS,
  POSIBILIDADES_CONTRATACION,
  RUBROS_EMPLEADOR,
  SI_NO,
  TAMANOS_EMPRESA,
  TIPOS_ORGANIZACION
} from '../data/catalogos';
import type { ResultadoGuardado } from '../utils/api';
import { BORRADOR_EMPLEADOR_VACIO, siguienteId, validarEmpleador, type BorradorEmpleador, type Errores } from '../utils/validacion';
import { EncabezadoPagina, Nota } from './ui/Estructura';
import { CampoCasillas, CampoOpciones, CampoSelect, CampoTexto, GrupoFormulario } from './ui/Formulario';

interface FormEmpleadoresSurveyProps {
  /** Envía la encuesta a la API y devuelve el registro guardado o los errores. */
  onGuardarEmpleador: (borrador: BorradorEmpleador) => Promise<ResultadoGuardado<Empleador>>;
  /** Ids ya usados, para validar como lo hace la base (en la encuesta pública, ninguno). */
  idsExistentes?: string[];
}

const OPCIONES_LIKERT = LIKERT_EMPLEADOR.map((texto) => ({ valor: texto, texto }));

export const FormEmpleadoresSurvey: React.FC<FormEmpleadoresSurveyProps> = ({ onGuardarEmpleador, idsExistentes = [] }) => {
  const [b, setB] = useState<BorradorEmpleador>(BORRADOR_EMPLEADOR_VACIO);
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState<boolean>(false);
  const [errorEnvio, setErrorEnvio] = useState<string>('');

  const set = <K extends keyof BorradorEmpleador>(campo: K, valor: BorradorEmpleador[K]) => setB((prev) => ({ ...prev, [campo]: valor }));
  const select = <K extends keyof BorradorEmpleador>(campo: K, etiqueta: string, opciones: readonly string[], obligatorio = true) => (
    <CampoSelect
      id={`emp-${String(campo)}`}
      etiqueta={etiqueta}
      valor={b[campo] as string}
      opciones={opciones}
      obligatorio={obligatorio}
      onCambiar={(v) => set(campo, v as BorradorEmpleador[K])}
      error={errores[campo as string]}
    />
  );

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const r = validarEmpleador(b, siguienteId(idsExistentes));
    setErrores(r.errores);
    setErrorEnvio('');
    if (!r.registro) return;

    setEnviando(true);
    const resultado = await onGuardarEmpleador(b);
    setEnviando(false);
    if (resultado.ok) {
      setB(BORRADOR_EMPLEADOR_VACIO);
    } else {
      setErrores(resultado.errores);
      setErrorEnvio(resultado.mensaje ?? '');
    }
  };

  const nErrores = Object.keys(errores).length;
  const respondidas = Object.keys(b.items_likert).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <EncabezadoPagina
        titulo="Encuesta a empleadores de titulados de Ingeniería de Sistemas"
        descripcion="Su opinión sobre los profesionales de la Carrera ayuda a evaluarla para la acreditación ARCU-SUR. Los campos con * son obligatorios."
      />
      {nErrores > 0 && <Nota tono="resalte">Revise {nErrores === 1 ? 'el campo marcado' : `los ${nErrores} campos marcados`}.</Nota>}
      {errorEnvio && <Nota tono="resalte">{errorEnvio}</Nota>}

      {/* Secciones en el orden de la encuesta oficial (Google Forms) */}
      <form onSubmit={enviar} noValidate className="space-y-4">
        <GrupoFormulario titulo="1. Datos de la organización">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <CampoTexto
                id="emp-organizacion"
                etiqueta="Nombre de la organización"
                obligatorio
                valor={b.organizacion}
                onCambiar={(v) => set('organizacion', v)}
                error={errores.organizacion}
              />
            </div>
            {select('tipo', 'Tipo', TIPOS_ORGANIZACION)}
            {select('tamano', 'Tamaño', TAMANOS_EMPRESA)}
            {select('rubro', 'Rubro', RUBROS_EMPLEADOR)}
          </div>
        </GrupoFormulario>

        <GrupoFormulario titulo="2. Contratación de titulados">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {select('contrato_5_anios', '¿Contrató ingenieros de sistemas en los últimos 5 años?', SI_NO)}
            {select('posibilidad_contratacion', 'Previsión de contratación', POSIBILIDADES_CONTRATACION)}
            {select('nivel_demandado', 'Nivel de formación exigido', NIVELES_DEMANDADOS)}
            {select('medio_convocatoria', 'Medio de convocatoria', MEDIOS_CONVOCATORIA, false)}
          </div>
          <CampoCasillas etiqueta="Cargos que ocupan los titulados" opciones={CARGOS_EMPLEADOR} seleccion={b.cargos} onCambiar={(v) => set('cargos', v)} />
        </GrupoFormulario>

        <GrupoFormulario titulo="3. Tecnologías y habilidades">
          <CampoTexto id="emp-tendencias" etiqueta="Tecnologías y tendencias que considera indispensables" multilinea valor={b.tendencias} onCambiar={(v) => set('tendencias', v)} />
          <CampoTexto id="emp-habilidades" etiqueta="Habilidades más valoradas" multilinea valor={b.habilidades} onCambiar={(v) => set('habilidades', v)} />
        </GrupoFormulario>

        <GrupoFormulario titulo={`4. Valoración de la Carrera (${respondidas} de ${AFIRMACIONES_EMPLEADORES.length} respondidas)`}>
          {errores.items_likert && <p className="text-xs text-resalte">{errores.items_likert}</p>}
          {DIMENSIONES_EMPLEADORES.map((dim) => (
            <div key={dim.dimension} className="space-y-4">
              <h3 className="text-sm font-medium text-slate-600">{dim.dimension}</h3>
              {AFIRMACIONES_EMPLEADORES.filter((af) => dim.afirmaciones.includes(af.numero)).map((af) => (
                <CampoOpciones
                  key={af.id}
                  etiqueta={`${af.numero}. ${af.texto}`}
                  valor={b.items_likert[af.id] ?? ''}
                  opciones={OPCIONES_LIKERT}
                  onCambiar={(v) => set('items_likert', { ...b.items_likert, [af.id]: v })}
                />
              ))}
            </div>
          ))}
        </GrupoFormulario>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setB(BORRADOR_EMPLEADOR_VACIO);
              setErrores({});
            }}
            className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded hover:bg-slate-50"
          >
            Limpiar
          </button>
          <button type="submit" disabled={enviando} className="px-4 py-2 text-sm text-white bg-institucional rounded hover:opacity-90 disabled:opacity-60">
            {enviando ? 'Enviando…' : 'Enviar encuesta'}
          </button>
        </div>
      </form>
    </div>
  );
};
