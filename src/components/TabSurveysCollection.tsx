import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Database, FileSpreadsheet, Loader2, RotateCcw, Upload, X } from 'lucide-react';
import type { Empleador, ItemEmpleador, Titulado } from '../types';
import { DICCIONARIO_TITULADOS } from '../data/dictionary';
import type { ModoImportacion } from '../data/catalogos';
import type { ProblemaImportacion } from '../utils/importador';
import {
  confirmarImportacion,
  ErrorApi,
  listarImportaciones,
  previsualizarImportacion,
  type EstadoImportado,
  type Importacion,
  type PrevisualizacionImportacion
} from '../utils/api';
import { EncabezadoPagina, Nota } from './ui/Estructura';
import { ExploradorDatos } from './ExploradorDatos';

interface TabSurveysCollectionProps {
  titulados: Titulado[];
  empleadores: Empleador[];
  itemsCount: number;
  /** Problemas del Excel de respaldo, si el panel lo está usando. */
  problemasBase: ProblemaImportacion[];
  /** true si se está viendo un archivo sin guardar («Solo analizar sin guardar»). */
  vistaTemporal: boolean;
  onSetTitulados: (titulados: Titulado[]) => void;
  onSetEmpleadores: (empleadores: Empleador[]) => void;
  onSetItems: (items: ItemEmpleador[]) => void;
  /** Vuelve a pedir los datos a la API (sin pantalla de carga). Devuelve true si lo logró. */
  onRecargar: () => Promise<boolean>;
  onNavigate: (tab: string) => void;
}

type SubPestana = 'importar' | 'explorador' | 'diccionario' | 'reglas';

const SUBPESTANAS: Array<[SubPestana, string]> = [
  ['importar', 'Importar'],
  ['explorador', 'Explorador'],
  ['diccionario', 'Diccionario'],
  ['reglas', 'Reglas de limpieza']
];

/** Máximo de problemas listados en pantalla (el total siempre se informa). */
const MAX_PROBLEMAS_VISIBLES = 50;

const FORMATOS: Record<PrevisualizacionImportacion['formato'], string> = {
  base_limpia: 'Base limpia (hojas Titulados, Empleadores e Items_empleadores, o CSV)',
  titulados_crudo: 'Excel crudo de Microsoft Forms (titulados), limpiado con las reglas de la base',
  empleadores_crudo: 'Excel crudo de Google Forms (empleadores), limpiado con las reglas de la base'
};

const MODOS: Array<{ id: ModoImportacion; titulo: string; descripcion: string }> = [
  { id: 'agregar', titulo: 'Agregar', descripcion: 'Solo inserta los Ids nuevos; no toca los registros que ya existen.' },
  { id: 'actualizar', titulo: 'Actualizar', descripcion: 'Inserta los nuevos y actualiza los existentes con el mismo Id que cambian.' },
  {
    id: 'reemplazar_oficial',
    titulo: 'Reemplazar la base oficial',
    descripcion:
      'Como «Actualizar» y, además, quita los registros de la base oficial que no están en el archivo (solo de las tablas que el archivo trae).'
  }
];

const NOMBRE_MODO = Object.fromEntries(MODOS.map((m) => [m.id, m.titulo])) as Record<ModoImportacion, string>;

const ESTADOS: Record<EstadoImportado, string> = {
  nuevo: 'Nuevo',
  sin_cambios: 'Sin cambios',
  cambia: 'Cambia',
  protegido: 'Protegido (encuesta de la web)'
};

const mensajeDe = (err: unknown) => (err instanceof ErrorApi || err instanceof Error ? err.message : String(err));

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function Paso({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-md p-5 space-y-4" aria-labelledby={`paso-${numero}`}>
      <h3 id={`paso-${numero}`} className="text-sm font-semibold text-slate-900">
        {numero}. {titulo}
      </h3>
      {children}
    </section>
  );
}

export const TabSurveysCollection: React.FC<TabSurveysCollectionProps> = ({
  titulados,
  empleadores,
  itemsCount,
  problemasBase,
  vistaTemporal,
  onSetTitulados,
  onSetEmpleadores,
  onSetItems,
  onRecargar,
  onNavigate
}) => {
  const [subPestana, setSubPestana] = useState<SubPestana>('importar');

  const [analizando, setAnalizando] = useState(false);
  const [previa, setPrevia] = useState<PrevisualizacionImportacion>();
  const [modo, setModo] = useState<ModoImportacion>('agregar');
  const [confirmaReemplazo, setConfirmaReemplazo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [recargando, setRecargando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tono: 'ok' | 'error' }>();
  const [historial, setHistorial] = useState<Importacion[]>();
  const [errorHistorial, setErrorHistorial] = useState<string>();

  const cargarHistorial = useCallback(async () => {
    try {
      setHistorial(await listarImportaciones());
      setErrorHistorial(undefined);
    } catch (err) {
      setErrorHistorial(mensajeDe(err));
    }
  }, []);

  useEffect(() => {
    if (subPestana === 'importar') void cargarHistorial();
  }, [subPestana, cargarHistorial]);

  const descartar = () => {
    setPrevia(undefined);
    setModo('agregar');
    setConfirmaReemplazo(false);
  };

  // Paso 1 → 2: el servidor interpreta el archivo y lo compara con la base, sin guardar nada
  const elegirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    descartar();
    setAviso(undefined);
    setAnalizando(true);
    try {
      setPrevia(await previsualizarImportacion(archivo));
    } catch (err) {
      setAviso({ texto: `No se pudo leer «${archivo.name}»: ${mensajeDe(err)}`, tono: 'error' });
    } finally {
      setAnalizando(false);
    }
  };

  // Paso 3: guardar en PostgreSQL y volver a pedir los datos a la API
  const guardar = async () => {
    if (!previa) return;
    setGuardando(true);
    setAviso(undefined);
    try {
      const r = await confirmarImportacion(previa.token, modo);
      descartar();
      const recargado = await onRecargar();
      const detalle = [r.omitidos > 0 && `${r.omitidos} omitidos`, r.eliminados > 0 && `${r.eliminados} quitados de la base oficial`].filter(Boolean);
      setAviso({
        texto:
          `Se guardaron ${r.insertados} nuevos y se actualizaron ${r.actualizados} en la base de datos` +
          (detalle.length > 0 ? ` (${detalle.join(', ')}).` : '.') +
          (recargado ? '' : ' No se pudieron volver a cargar los datos; use «Recargar desde la base de datos».'),
        tono: 'ok'
      });
      void cargarHistorial();
    } catch (err) {
      setAviso({ texto: mensajeDe(err), tono: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  // Comportamiento anterior: ver el archivo en el panel sin guardarlo
  const soloAnalizar = () => {
    if (!previa) return;
    const { titulados: t, empleadores: e, items } = previa.datos;
    if (t.length > 0) onSetTitulados(t);
    if (e.length > 0) onSetEmpleadores(e);
    if (items.length > 0) onSetItems(items);
    // El panel y el Header avisan que la vista es temporal
    setAviso(undefined);
    descartar();
  };

  const recargar = async () => {
    setRecargando(true);
    const ok = await onRecargar();
    setRecargando(false);
    setAviso(ok ? { texto: 'Datos recargados desde la base de datos.', tono: 'ok' } : { texto: 'No se pudo conectar con la base de datos.', tono: 'error' });
  };

  const resultado = previa?.porModo[modo];
  const puedeGuardar = !!previa && !guardando && (modo !== 'reemplazar_oficial' || confirmaReemplazo);

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Base de datos"
        descripcion="Importe archivos a PostgreSQL, explore los registros y consulte el diccionario y las reglas de limpieza."
      />

      <nav className="flex flex-wrap gap-1 border-b border-slate-200" aria-label="Secciones de la base de datos">
        {SUBPESTANAS.map(([id, etiqueta]) => (
          <button
            key={id}
            onClick={() => setSubPestana(id)}
            aria-current={subPestana === id ? 'page' : undefined}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              subPestana === id ? 'border-institucional text-institucional font-medium' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </nav>

      {aviso && (
        <div
          role={aviso.tono === 'error' ? 'alert' : 'status'}
          className={`flex items-start justify-between gap-3 border-l-4 px-4 py-3 text-sm ${
            aviso.tono === 'ok' ? 'border-institucional bg-institucional-fondo text-slate-800' : 'border-resalte bg-resalte-fondo text-slate-800'
          }`}
        >
          <span className="flex items-start gap-2">
            {aviso.tono === 'ok' ? (
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-institucional" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-resalte" aria-hidden="true" />
            )}
            {aviso.texto}
          </span>
          <button onClick={() => setAviso(undefined)} className="text-slate-500 hover:text-slate-800" aria-label="Cerrar aviso">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {subPestana === 'importar' && (
        <div className="space-y-6">
          {/* Lo que se ve en el panel */}
          <div className="bg-white border border-slate-200 rounded-md p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-sm">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Database className="w-4 h-4 text-institucional" aria-hidden="true" />
                {vistaTemporal ? 'Vista temporal: estos datos NO están guardados' : 'Datos de la base de datos'}
              </div>
              <p className="mt-1 text-slate-600">
                {titulados.length} titulados · {empleadores.length} empleadores · {itemsCount} afirmaciones de empleadores
              </p>
            </div>
            <button
              onClick={() => void recargar()}
              disabled={recargando}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-700 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-60 shrink-0"
            >
              <RotateCcw className={`w-4 h-4 ${recargando ? 'animate-spin' : ''}`} aria-hidden="true" />
              Recargar desde la base de datos
            </button>
          </div>

          <Paso numero={1} titulo="Elegir archivo">
            <p className="text-sm text-slate-600">
              Se aceptan la base limpia (libro con hojas <code className="text-xs">Titulados</code>, <code className="text-xs">Empleadores</code> e{' '}
              <code className="text-xs">Items_empleadores</code>, o un CSV con sus columnas) y los Excel <strong>crudos</strong> exportados de
              Microsoft Forms (titulados) o Google Forms (empleadores), que se limpian con las reglas de la base. Hasta 10 MB, .xlsx o .csv. Elegir el
              archivo no guarda nada.
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-institucional hover:bg-institucional/90 rounded cursor-pointer">
              {analizando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Upload className="w-4 h-4" aria-hidden="true" />}
              {analizando ? 'Analizando el archivo…' : 'Elegir archivo'}
              <input type="file" accept=".xlsx,.csv" className="sr-only" disabled={analizando} onChange={(e) => void elegirArchivo(e)} aria-label="Archivo a importar" />
            </label>
          </Paso>

          {previa && (
            <>
              <Paso numero={2} titulo="Revisar la previsualización">
                <p className="text-sm text-slate-600 flex items-start gap-2">
                  <FileSpreadsheet className="w-4 h-4 mt-0.5 shrink-0 text-institucional" aria-hidden="true" />
                  <span className="min-w-0 break-all">
                    <strong className="text-slate-900">{previa.archivo}</strong> <span className="break-normal">· {FORMATOS[previa.formato]}</span>
                  </span>
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left" aria-label="Resumen de la previsualización">
                    <thead className="text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2 pr-4 font-medium">Tabla</th>
                        <th className="py-2 px-3 font-medium text-right">En el archivo</th>
                        <th className="py-2 px-3 font-medium text-right">Nuevos</th>
                        <th className="py-2 px-3 font-medium text-right">Cambian</th>
                        <th className="py-2 px-3 font-medium text-right">Sin cambios</th>
                        <th className="py-2 pl-3 font-medium text-right">Protegidos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 tabular-nums">
                      {(['titulados', 'empleadores'] as const).map((tabla) => (
                        <tr key={tabla}>
                          <td className="py-2 pr-4 capitalize">{tabla}</td>
                          <td className="py-2 px-3 text-right">{previa.cantidades[tabla]}</td>
                          <td className="py-2 px-3 text-right">{previa.estados[tabla].nuevo}</td>
                          <td className="py-2 px-3 text-right">{previa.estados[tabla].cambia}</td>
                          <td className="py-2 px-3 text-right">{previa.estados[tabla].sin_cambios}</td>
                          <td className="py-2 pl-3 text-right">{previa.estados[tabla].protegido}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">
                  Los registros se comparan por Id. «Protegidos» son Ids de encuestas guardadas desde la web: nunca se modifican.
                </p>

                {previa.totalProblemas > 0 ? (
                  <details className="border border-slate-200 rounded">
                    <summary className="px-3 py-2 text-sm cursor-pointer text-slate-800">
                      {previa.totalProblemas} problemas por fila ({previa.problemas.filter((p) => p.severidad === 'error').length} errores; el resto son
                      advertencias o correcciones de la limpieza)
                    </summary>
                    <div className="overflow-x-auto border-t border-slate-200">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="p-2 font-medium">Hoja</th>
                            <th className="p-2 font-medium text-right">Fila / Id</th>
                            <th className="p-2 font-medium">Columna</th>
                            <th className="p-2 font-medium">Valor</th>
                            <th className="p-2 font-medium">Problema</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {previa.problemas.slice(0, MAX_PROBLEMAS_VISIBLES).map((p, i) => (
                            <tr key={i} className={p.severidad === 'error' ? 'bg-resalte-fondo' : ''}>
                              <td className="p-2">{p.hoja}</td>
                              <td className="p-2 text-right font-mono">{p.fila ?? p.id ?? '—'}</td>
                              <td className="p-2 font-mono">{p.columna ?? '—'}</td>
                              <td className="p-2 font-mono max-w-xs truncate">{p.valor ?? '—'}</td>
                              <td className="p-2">{p.mensaje}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {previa.totalProblemas > MAX_PROBLEMAS_VISIBLES && (
                        <p className="p-2 text-xs text-slate-500 text-right border-t border-slate-100">
                          Se muestran {MAX_PROBLEMAS_VISIBLES} de {previa.totalProblemas}
                        </p>
                      )}
                    </div>
                  </details>
                ) : (
                  <p className="text-sm text-slate-600 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-institucional" aria-hidden="true" />
                    Sin problemas en el archivo.
                  </p>
                )}

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-800">Primeras filas</h4>
                  <div className="overflow-x-auto border border-slate-200 rounded">
                    <table className="w-full text-xs text-left" aria-label="Primeras filas del archivo">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="p-2 font-medium">Tabla</th>
                          <th className="p-2 font-medium text-right">Id</th>
                          <th className="p-2 font-medium">Estado</th>
                          <th className="p-2 font-medium">Datos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previa.muestra.titulados.map(({ estado, registro: t }) => (
                          <tr key={`t${t.id}`}>
                            <td className="p-2">Titulado</td>
                            <td className="p-2 text-right font-mono">{t.id}</td>
                            <td className="p-2">{ESTADOS[estado]}</td>
                            <td className="p-2 text-slate-600">
                              {t.edad} · {t.genero} · {t.situacion_laboral}
                              {t.anios_vida_profesional !== undefined && ` · ${t.anios_vida_profesional} años de vida profesional`}
                            </td>
                          </tr>
                        ))}
                        {previa.muestra.empleadores.map(({ estado, registro: e }) => (
                          <tr key={`e${e.id}`}>
                            <td className="p-2">Empleador</td>
                            <td className="p-2 text-right font-mono">{e.id}</td>
                            <td className="p-2">{ESTADOS[estado]}</td>
                            <td className="p-2 text-slate-600">
                              {e.organizacion} · {e.tipo} · {e.tamano}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Paso>

              <Paso numero={3} titulo="Guardar en la base de datos">
                <fieldset className="space-y-2">
                  <legend className="text-sm text-slate-700 mb-2">Modo</legend>
                  {MODOS.map((m) => {
                    const t = previa.porModo[m.id];
                    return (
                      <label
                        key={m.id}
                        className={`flex items-start gap-3 p-3 border rounded cursor-pointer ${modo === m.id ? 'border-institucional bg-institucional-fondo' : 'border-slate-200'}`}
                      >
                        <input
                          type="radio"
                          name="modo-importacion"
                          value={m.id}
                          checked={modo === m.id}
                          onChange={() => {
                            setModo(m.id);
                            setConfirmaReemplazo(false);
                          }}
                          className="mt-1"
                        />
                        <span className="text-sm">
                          <span className="font-medium text-slate-900">{m.titulo}</span>
                          <span className="block text-slate-600">{m.descripcion}</span>
                          <span className="block text-xs text-slate-500 tabular-nums mt-0.5">
                            {t.insertados} nuevos · {t.actualizados} actualizados · {t.omitidos} omitidos
                            {t.eliminados > 0 && ` · ${t.eliminados} quitados de la base oficial`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>

                {modo === 'reemplazar_oficial' && resultado && (
                  <label className="flex items-start gap-2 border-l-4 border-resalte bg-resalte-fondo px-3 py-2 text-sm text-slate-800">
                    <input type="checkbox" checked={confirmaReemplazo} onChange={(e) => setConfirmaReemplazo(e.target.checked)} className="mt-1" />
                    <span>
                      Entiendo que se reemplazará la base oficial: se actualizarán {resultado.actualizados} registros y se quitarán {resultado.eliminados}{' '}
                      que no están en el archivo. Las encuestas guardadas desde la web no se tocan.
                    </span>
                  </label>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => void guardar()}
                    disabled={!puedeGuardar}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-institucional hover:bg-institucional/90 rounded disabled:opacity-50"
                  >
                    {guardando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                    {guardando ? 'Guardando…' : 'Guardar en la base de datos'}
                  </button>
                  <button onClick={soloAnalizar} disabled={guardando} className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded hover:bg-slate-50">
                    Solo analizar sin guardar
                  </button>
                  <button onClick={descartar} disabled={guardando} className="px-2 py-2 text-sm text-slate-600 hover:text-slate-900 hover:underline">
                    Descartar
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Se guarda todo en una sola transacción: si algo falla, no se guarda ningún registro. La previsualización vence a las{' '}
                  {new Date(previa.vence).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </Paso>
            </>
          )}

          <section className="bg-white border border-slate-200 rounded-md p-5 space-y-3" aria-labelledby="titulo-historial">
            <h3 id="titulo-historial" className="text-sm font-semibold text-slate-900">
              Historial de importaciones
            </h3>
            {errorHistorial && <Nota tono="resalte">No se pudo cargar el historial: {errorHistorial}</Nota>}
            {historial?.length === 0 && <p className="text-sm text-slate-600">Todavía no se importó ningún archivo.</p>}
            {historial && historial.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left" aria-label="Historial de importaciones">
                  <thead className="text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Fecha</th>
                      <th className="py-2 px-3 font-medium">Usuario</th>
                      <th className="py-2 px-3 font-medium">Archivo</th>
                      <th className="py-2 px-3 font-medium">Modo</th>
                      <th className="py-2 px-3 font-medium text-right">Nuevos</th>
                      <th className="py-2 px-3 font-medium text-right">Actualizados</th>
                      <th className="py-2 px-3 font-medium text-right">Omitidos</th>
                      <th className="py-2 pl-3 font-medium text-right">Quitados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {historial.map((h) => (
                      <tr key={h.id}>
                        <td className="py-2 pr-3 whitespace-nowrap">{fechaHora(h.created_at)}</td>
                        <td className="py-2 px-3">{h.usuario ?? '—'}</td>
                        <td className="py-2 px-3 max-w-56 truncate" title={h.archivo}>
                          {h.archivo}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">{NOMBRE_MODO[h.modo]}</td>
                        <td className="py-2 px-3 text-right">{h.insertados}</td>
                        <td className="py-2 px-3 text-right">{h.actualizados}</td>
                        <td className="py-2 px-3 text-right">{h.omitidos}</td>
                        <td className="py-2 pl-3 text-right">{h.eliminados}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {problemasBase.length > 0 && (
            <Nota tono="resalte">
              El panel usa el Excel de respaldo y tiene {problemasBase.length} problemas de validación. Recargue desde la base de datos cuando vuelva la
              conexión.
            </Nota>
          )}
        </div>
      )}

      {subPestana === 'explorador' && <ExploradorDatos titulados={titulados} empleadores={empleadores} onNavigate={onNavigate} />}

      {subPestana === 'diccionario' && (
        <section className="bg-white border border-slate-200 rounded-md p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Diccionario de datos (Anexo C)</h3>
            <p className="text-sm text-slate-600 mt-1">Variables de la hoja Titulados de la base limpia, con su tipo y valores posibles.</p>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-2.5 font-medium">Variable</th>
                  <th className="p-2.5 font-medium">Nombre</th>
                  <th className="p-2.5 font-medium">Tipo</th>
                  <th className="p-2.5 font-medium">Descripción y valores</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {DICCIONARIO_TITULADOS.map((v) => (
                  <tr key={v.codigo}>
                    <td className="p-2.5 font-mono text-slate-900">{v.codigo}</td>
                    <td className="p-2.5 text-slate-900">{v.nombre}</td>
                    <td className="p-2.5 text-slate-600">{v.tipo}</td>
                    <td className="p-2.5 text-slate-600 max-w-md">
                      <div>{v.descripcion}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{v.valoresPosibles}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {subPestana === 'reglas' && (
        <section className="bg-white border border-slate-200 rounded-md p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Reglas de limpieza</h3>
            <p className="text-sm text-slate-600 mt-1">
              Se aplican a los Excel crudos de Microsoft Forms y Google Forms, tanto al generar la base limpia (npm run cargar-encuestas) como al importarlos
              aquí.
            </p>
          </div>
          <ol className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[
              ['Años escritos como texto', '«2 años», «1,5» o «Dos años» pasan a número; los meses se dividen entre 12 («6 meses» → 0.5).'],
              ['Inconsistencias lógicas', 'El tiempo sin empleo que supera los años de vida profesional queda sin respuesta, igual que los textos sin sentido.'],
              ['Respuestas de prueba', 'Se descartan las respuestas sin contenido, como las organizaciones «lll» o «G» entre los empleadores.'],
              ['Selección múltiple', 'Las opciones de una misma celda (separadas por «;») se guardan como listas en las tablas intermedias.'],
              ['Etiquetas', 'Las respuestas se normalizan a los catálogos de la base (por ejemplo, «DIRECCIÓN DE POSGRADO FCyT» → «Posgrado FCyT»).']
            ].map(([titulo, texto], i) => (
              <li key={titulo} className="p-4 rounded border border-slate-200 bg-slate-50">
                <span className="font-medium text-slate-900 block">
                  {i + 1}. {titulo}
                </span>
                <span className="text-slate-600">{texto}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
};
