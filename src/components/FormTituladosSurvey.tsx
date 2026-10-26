import React, { useState } from 'react';
import { Titulado } from '../types';
import {
  AREAS_POSGRADO,
  ASIGNATURAS_NO_UTILES,
  ASIGNATURAS_VENTAJA,
  CARGOS_TITULADO,
  EDADES,
  FINANCIAMIENTOS,
  GENEROS,
  INSTITUCIONES_PREFERIDAS,
  LIKERT_TITULADOS,
  LUGARES_POSGRADO,
  NIVELES_POSGRADO,
  REMUNERACIONES,
  RUBROS_TITULADO,
  SECTORES,
  SI_NO,
  SITUACIONES_LABORALES,
  TIEMPOS_PRIMER_EMPLEO,
  type Likert
} from '../data/catalogos';
import type { ResultadoGuardado } from '../utils/api';
import { BORRADOR_TITULADO_VACIO, siguienteId, validarTitulado, type BorradorTitulado, type Errores } from '../utils/validacion';
import { EncabezadoPagina, Nota } from './ui/Estructura';
import { CampoCasillas, CampoOpciones, CampoSelect, CampoTexto, GrupoFormulario } from './ui/Formulario';

interface FormTituladosSurveyProps {
  /** Guarda la encuesta (en la API o, sin conexión, en memoria) y devuelve el registro guardado. */
  onGuardarTitulado: (borrador: BorradorTitulado, registroLocal: Titulado) => Promise<ResultadoGuardado<Titulado>>;
  onNavigateToAnalytics: () => void;
  idsExistentes: string[];
}

const OPCIONES_LIKERT = LIKERT_TITULADOS.map((texto, i) => ({ valor: (i + 1) as Likert, texto }));

export const FormTituladosSurvey: React.FC<FormTituladosSurveyProps> = ({ onGuardarTitulado, onNavigateToAnalytics, idsExistentes }) => {
  const [b, setB] = useState<BorradorTitulado>(BORRADOR_TITULADO_VACIO);
  const [errores, setErrores] = useState<Errores>({});
  const [guardado, setGuardado] = useState<string>('');
  const [enviando, setEnviando] = useState<boolean>(false);
  const [errorEnvio, setErrorEnvio] = useState<string>('');

  const set = <K extends keyof BorradorTitulado>(campo: K, valor: BorradorTitulado[K]) => setB((prev) => ({ ...prev, [campo]: valor }));
  const select = <K extends keyof BorradorTitulado>(campo: K, etiqueta: string, opciones: readonly string[]) => (
    <CampoSelect
      id={`tit-${String(campo)}`}
      etiqueta={etiqueta}
      valor={b[campo] as string}
      opciones={opciones}
      onCambiar={(v) => set(campo, v as BorradorTitulado[K])}
      error={errores[campo as string]}
    />
  );
  const likert = (campo: 'satisfaccion_global' | 'concordancia_formacion' | 'pertinencia_labores' | 'opinion_posgrado_fcyt', etiqueta: string) => (
    <CampoOpciones etiqueta={etiqueta} valor={b[campo]} opciones={OPCIONES_LIKERT} onCambiar={(v) => set(campo, v)} error={errores[campo]} />
  );

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const r = validarTitulado(b, siguienteId(idsExistentes));
    setErrores(r.errores);
    setGuardado('');
    setErrorEnvio('');
    if (!r.registro) return;

    setEnviando(true);
    const resultado = await onGuardarTitulado(b, r.registro);
    setEnviando(false);
    if (resultado.ok) {
      setGuardado(resultado.registro.id);
      setB(BORRADOR_TITULADO_VACIO);
    } else {
      setErrores(resultado.errores);
      setErrorEnvio(resultado.mensaje ?? '');
    }
  };

  const nErrores = Object.keys(errores).length;
  const trabaja = b.situacion_laboral !== '' && b.situacion_laboral !== 'No trabaja';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <EncabezadoPagina titulo="Encuesta a titulados" descripcion="Los campos con * son obligatorios. La respuesta se agrega a la base activa." />

      {guardado && (
        <Nota>
          Se registró la encuesta n.º {guardado}.{' '}
          <button onClick={onNavigateToAnalytics} className="text-institucional hover:underline">
            Ver el perfil de los titulados
          </button>
        </Nota>
      )}
      {nErrores > 0 && <Nota tono="resalte">Revise {nErrores === 1 ? 'el campo marcado' : `los ${nErrores} campos marcados`}.</Nota>}
      {errorEnvio && <Nota tono="resalte">{errorEnvio}</Nota>}

      <form onSubmit={enviar} noValidate className="space-y-4">
        <GrupoFormulario titulo="Datos generales">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {select('edad', 'Edad', EDADES)}
            {select('genero', 'Género', GENEROS)}
            <CampoTexto
              id="tit-vida"
              etiqueta="Años de vida profesional"
              tipo="number"
              obligatorio
              valor={b.anios_vida_profesional}
              onCambiar={(v) => set('anios_vida_profesional', v)}
              error={errores.anios_vida_profesional}
            />
            <CampoTexto
              id="tit-desempleo"
              etiqueta="Años sin empleo acumulados"
              tipo="number"
              obligatorio
              ayuda="0 si nunca estuvo sin empleo; no puede superar los años de vida profesional"
              valor={b.anios_desempleado}
              onCambiar={(v) => set('anios_desempleado', v)}
              error={errores.anios_desempleado}
            />
          </div>
        </GrupoFormulario>

        <GrupoFormulario titulo="Formación de posgrado">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {select('formacion_complementaria', '¿Cursó algún posgrado?', SI_NO)}
            {b.formacion_complementaria === 'Sí' && (
              <>
                {select('nivel_realizado', 'Nivel cursado', NIVELES_POSGRADO)}
                {select('lugar_realizado', 'Institución donde lo cursó', LUGARES_POSGRADO)}
                {select('financiamiento', 'Financiamiento', FINANCIAMIENTOS)}
              </>
            )}
            {select('interes_posgrado', '¿Le interesa cursar un posgrado?', SI_NO)}
            {b.interes_posgrado === 'Sí' && (
              <>
                {select('area_interes', 'Área de interés', AREAS_POSGRADO)}
                {select('institucion_preferida', 'Institución preferida', INSTITUCIONES_PREFERIDAS)}
              </>
            )}
          </div>
        </GrupoFormulario>

        <GrupoFormulario titulo="Situación laboral">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {select('situacion_laboral', 'Situación laboral actual', SITUACIONES_LABORALES)}
            {trabaja && (
              <>
                {select('sector', 'Sector', SECTORES)}
                {select('rubro', 'Rubro', RUBROS_TITULADO)}
                {select('cargo', 'Cargo', CARGOS_TITULADO)}
                {select('remuneracion', 'Remuneración mensual', REMUNERACIONES)}
                {select('tiempo_primer_empleo', 'Tiempo para conseguir el primer empleo', TIEMPOS_PRIMER_EMPLEO)}
              </>
            )}
          </div>
        </GrupoFormulario>

        <GrupoFormulario titulo="Valoración de la formación">
          {likert('satisfaccion_global', 'Satisfacción global con la formación recibida')}
          {likert('concordancia_formacion', 'Concordancia entre la formación y los requerimientos laborales')}
          {trabaja && likert('pertinencia_labores', 'Sus labores actuales son pertinentes a su formación')}
          {likert('opinion_posgrado_fcyt', 'Existen posgrados afines en la Dirección de Posgrado FCyT')}
        </GrupoFormulario>

        <GrupoFormulario titulo="Asignaturas">
          <CampoCasillas
            etiqueta="Asignaturas que le dieron ventaja competitiva"
            opciones={ASIGNATURAS_VENTAJA}
            seleccion={b.asignaturas_ventaja}
            onCambiar={(v) => set('asignaturas_ventaja', v)}
          />
          <CampoCasillas
            etiqueta="Asignaturas de poca utilidad en su trabajo"
            opciones={ASIGNATURAS_NO_UTILES}
            seleccion={b.asignaturas_no_utiles}
            onCambiar={(v) => set('asignaturas_no_utiles', v)}
          />
        </GrupoFormulario>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setB(BORRADOR_TITULADO_VACIO);
              setErrores({});
            }}
            className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded hover:bg-slate-50"
          >
            Limpiar
          </button>
          <button type="submit" disabled={enviando} className="px-4 py-2 text-sm text-white bg-institucional rounded hover:opacity-90 disabled:opacity-60">
            {enviando ? 'Guardando…' : 'Guardar encuesta'}
          </button>
        </div>
      </form>
    </div>
  );
};
