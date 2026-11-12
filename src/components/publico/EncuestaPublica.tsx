import React, { lazy, Suspense, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { enviarEmpleadorPublico, enviarTituladoPublico } from '../../utils/api';
import { CAMPO_TRAMPA, type BorradorEmpleador, type BorradorTitulado } from '../../utils/validacion';
import { PaginaPublica, VolverAlInicio } from './Publico';

const FormTituladosSurvey = lazy(() => import('../FormTituladosSurvey').then((m) => ({ default: m.FormTituladosSurvey })));
const FormEmpleadoresSurvey = lazy(() => import('../FormEmpleadoresSurvey').then((m) => ({ default: m.FormEmpleadoresSurvey })));

/**
 * Encuesta pública (titulados o empleadores): se llena sin cuenta. Al enviarla con éxito se
 * muestra el agradecimiento. Incluye un campo trampa oculto: una persona no lo ve ni lo llena.
 */
export function EncuestaPublica({ tipo, onVolver }: { tipo: 'titulados' | 'empleadores'; onVolver: () => void }) {
  const [enviada, setEnviada] = useState(false);
  const [trampa, setTrampa] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [enviada]);

  const alGuardar = <R extends { ok: boolean }>(resultado: R) => {
    if (resultado.ok) setEnviada(true);
    return resultado;
  };

  if (enviada) {
    return (
      <PaginaPublica ancho="max-w-xl">
        <section className="bg-white border border-slate-200 rounded-lg p-8 text-center" aria-labelledby="titulo-gracias">
          <CheckCircle2 className="w-12 h-12 mx-auto text-institucional" aria-hidden="true" />
          <h1 id="titulo-gracias" className="mt-4 text-xl font-semibold text-slate-900">
            ¡Gracias por responder la encuesta!
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Su respuesta se guardó. La Carrera de Ingeniería de Sistemas la usará en su proceso de autoevaluación y acreditación ARCU-SUR.
          </p>
          <button
            onClick={onVolver}
            className="mt-6 inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-institucional hover:bg-institucional/90 rounded"
          >
            Volver al inicio
          </button>
        </section>
      </PaginaPublica>
    );
  }

  return (
    <PaginaPublica>
      <div className="mb-6">
        <VolverAlInicio onVolver={onVolver} />
      </div>

      {/* Campo trampa contra bots: fuera de la pantalla, sin foco con Tab y oculto a lectores de pantalla */}
      <div aria-hidden="true" className="absolute -left-[10000px] top-auto w-px h-px overflow-hidden">
        <label htmlFor={CAMPO_TRAMPA}>Sitio web (no completar)</label>
        <input id={CAMPO_TRAMPA} name={CAMPO_TRAMPA} type="text" tabIndex={-1} autoComplete="off" value={trampa} onChange={(e) => setTrampa(e.target.value)} />
      </div>

      <Suspense fallback={<p className="text-sm text-slate-500">Cargando la encuesta…</p>}>
        {tipo === 'titulados' ? (
          <FormTituladosSurvey onGuardarTitulado={async (b: BorradorTitulado) => alGuardar(await enviarTituladoPublico(b, trampa))} />
        ) : (
          <FormEmpleadoresSurvey onGuardarEmpleador={async (b: BorradorEmpleador) => alGuardar(await enviarEmpleadorPublico(b, trampa))} />
        )}
      </Suspense>
    </PaginaPublica>
  );
}
