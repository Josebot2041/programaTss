/**
 * Panel de análisis (solo administradores; App.tsx lo muestra con una sesión de admin).
 * Carga los datos de la API al abrirse y los recarga al volver a la pestaña del navegador.
 */

import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AlertCircle, CloudOff, FileSpreadsheet, Loader2, RotateCcw } from 'lucide-react';
import type { Empleador, ItemEmpleador, Titulado } from '../types';
import { cargarBaseReal, NOMBRE_BASE_REAL, type ProblemaImportacion } from '../utils/importador';
import { cargarDesdeApi, ErrorApi, esFallaDelServidor } from '../utils/api';
import type { Usuario } from '../utils/validacionUsuario';
import { INFO_INSTITUCIONAL } from '../data/strategicPlan';
import { Sidebar } from './Sidebar';
import { Header, type FuenteDatos } from './Header';
import { EncabezadoPagina } from './ui/Estructura';

// Cada sección se descarga al abrirla (Recharts y el resto del código no bloquean la carga inicial)
const TabOverview = lazy(() => import('./TabOverview').then((m) => ({ default: m.TabOverview })));
const TabProfileGraduates = lazy(() => import('./TabProfileGraduates').then((m) => ({ default: m.TabProfileGraduates })));
const TabLaborMarket = lazy(() => import('./TabLaborMarket').then((m) => ({ default: m.TabLaborMarket })));
const TabCurriculumEvaluation = lazy(() => import('./TabCurriculumEvaluation').then((m) => ({ default: m.TabCurriculumEvaluation })));
const TabChiSquareAnalysis = lazy(() => import('./TabChiSquareAnalysis').then((m) => ({ default: m.TabChiSquareAnalysis })));
const TabSimulationEngine = lazy(() => import('./TabSimulationEngine').then((m) => ({ default: m.TabSimulationEngine })));
const TabSurveysCollection = lazy(() => import('./TabSurveysCollection').then((m) => ({ default: m.TabSurveysCollection })));
const TabStrategicPlan = lazy(() => import('./TabStrategicPlan').then((m) => ({ default: m.TabStrategicPlan })));
const ExploradorDatos = lazy(() => import('./ExploradorDatos').then((m) => ({ default: m.ExploradorDatos })));
const PanelControl = lazy(() => import('./admin/PanelControl').then((m) => ({ default: m.PanelControl })));
const AdminUsuarios = lazy(() => import('./admin/AdminUsuarios').then((m) => ({ default: m.AdminUsuarios })));
const AccesosDashboard = lazy(() => import('./admin/AccesosDashboard').then((m) => ({ default: m.AccesosDashboard })));
const OfficialReportModal = lazy(() => import('./OfficialReportModal').then((m) => ({ default: m.OfficialReportModal })));

/** Destinos fuera del panel a los que llevan algunos botones (p. ej. «+ Encuesta Titulado»). */
export type DestinoExterno = 'encuesta-titulados' | 'encuesta-empleadores' | 'portada';

const ENCUESTAS: Record<string, DestinoExterno> = {
  encuesta_titulados: 'encuesta-titulados',
  encuesta_empleadores: 'encuesta-empleadores'
};

interface PanelProps {
  usuario: Usuario;
  seccion: string;
  /** Abre el informe imprimible al entrar (enlace /#panel/informe). */
  informeInicial?: boolean;
  onSeccion: (seccion: string) => void;
  onSalir: (destino: DestinoExterno) => void;
  onCerrarSesion: () => void;
}

export function Panel({ usuario, seccion, informeInicial = false, onSeccion, onSalir, onCerrarSesion }: PanelProps) {
  const [titulados, setTitulados] = useState<Titulado[]>([]);
  const [empleadores, setEmpleadores] = useState<Empleador[]>([]);
  const [itemsEmpleadores, setItemsEmpleadores] = useState<ItemEmpleador[]>([]);
  const [estadoCarga, setEstadoCarga] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [errorCarga, setErrorCarga] = useState<string>('');
  const [problemasBase, setProblemasBase] = useState<ProblemaImportacion[]>([]);
  // Archivos de public/data de los que salió el respaldo
  const [archivosRespaldo, setArchivosRespaldo] = useState<string[]>([]);
  const [reportModalOpen, setReportModalOpen] = useState<boolean>(informeInicial);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // 'api': datos de PostgreSQL; 'excel': respaldo local porque la API no respondió; 'archivo': un
  // archivo importado a mano en «Base de datos». El Header muestra siempre cuál está activa.
  const [fuente, setFuente] = useState<FuenteDatos>('api');
  // false si la última recarga en segundo plano falló: los datos a la vista pueden estar atrasados
  const [alDia, setAlDia] = useState(true);
  const [recargando, setRecargando] = useState(false);

  // Los botones que llevaban a las encuestas del panel ahora abren las encuestas públicas
  const irA = useCallback(
    (destino: string) => {
      if (ENCUESTAS[destino]) onSalir(ENCUESTAS[destino]);
      else onSeccion(destino);
    },
    [onSalir, onSeccion]
  );

  /**
   * Pide los datos a la API. Según el error:
   * - 401: la sesión terminó; avisarAlPerderSesion ya volvió al login. Nunca se usa el Excel.
   * - Sin conexión o 5xx: se usa el Excel de public/data como respaldo, indicado en el Header.
   * - Otro error (403, 404…): pantalla de error con «Reintentar».
   * En segundo plano (`silencioso`) no se muestra la pantalla de carga y, si falla, se conservan los
   * datos a la vista marcados como «sin actualizar». Devuelve true si los datos vienen de la API.
   */
  const cargarBase = useCallback(async (silencioso = false): Promise<boolean> => {
    if (silencioso) setRecargando(true);
    else setEstadoCarga('cargando');
    try {
      const datos = await cargarDesdeApi();
      setTitulados(datos.titulados);
      setEmpleadores(datos.empleadores);
      setItemsEmpleadores(datos.items);
      setProblemasBase([]);
      setFuente('api');
      setAlDia(true);
      setEstadoCarga('listo');
      return true;
    } catch (err) {
      if (err instanceof ErrorApi && err.estado === 401) return false;
      if (silencioso) {
        setAlDia(false);
        return false;
      }
      if (!esFallaDelServidor(err)) {
        setErrorCarga(err instanceof Error ? err.message : String(err));
        setEstadoCarga('error');
        return false;
      }
    } finally {
      setRecargando(false);
    }
    try {
      const resultado = await cargarBaseReal();
      setTitulados(resultado.titulados ?? []);
      setEmpleadores(resultado.empleadores ?? []);
      setItemsEmpleadores(resultado.items ?? []);
      setProblemasBase(resultado.problemas);
      setArchivosRespaldo([...new Set(Object.values(resultado.fuentes))]);
      setFuente('excel');
      setAlDia(true);
      setEstadoCarga('listo');
    } catch (err) {
      setErrorCarga(err instanceof Error ? err.message : String(err));
      setEstadoCarga('error');
    }
    return false;
  }, []);

  // El panel solo se monta con una sesión de administrador: los datos se piden al abrirlo
  useEffect(() => {
    void cargarBase();
  }, [cargarBase]);

  // Al volver a la pestaña se recargan los datos (pudieron llegar encuestas desde la portada),
  // salvo que se esté analizando un archivo importado a mano
  const hayDatos = estadoCarga === 'listo';
  useEffect(() => {
    if (!hayDatos || fuente === 'archivo') return;
    const alVolver = () => {
      if (document.visibilityState === 'visible') void cargarBase(true);
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [hayDatos, fuente, cargarBase]);

  if (estadoCarga !== 'listo') {
    return (
      <div className="min-h-screen bg-slate-100/70 flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs max-w-md w-full text-center space-y-3">
          {estadoCarga === 'cargando' ? (
            <>
              <Loader2 className="w-6 h-6 text-sky-800 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-900">Cargando la base de datos real…</p>
              <p className="text-xs text-slate-500">
                Servidor PostgreSQL o, sin conexión, <span className="font-mono">{NOMBRE_BASE_REAL}</span>
              </p>
            </>
          ) : (
            <>
              <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-900">No se pudo cargar la base de datos</p>
              <p className="text-xs text-slate-600">{errorCarga}</p>
              <button
                onClick={() => void cargarBase()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-sky-900 hover:bg-sky-800 rounded-md"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reintentar
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased selection:bg-sky-100 selection:text-sky-900 flex">
      <Sidebar
        activeTab={seccion}
        setActiveTab={irA}
        onOpenReport={() => setReportModalOpen(true)}
        tituladosCount={titulados.length}
        empleadoresCount={empleadores.length}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onVerPortada={() => onSalir('portada')}
      />

      <div className={`flex-1 flex flex-col min-w-0 lg:pl-64 ${reportModalOpen ? 'print:hidden' : ''}`}>
        <Header
          activeTab={seccion}
          onOpenReport={() => setReportModalOpen(true)}
          tituladosCount={titulados.length}
          empleadoresCount={empleadores.length}
          onToggleMobileMenu={() => setIsMobileSidebarOpen(true)}
          usuario={usuario}
          onCerrarSesion={onCerrarSesion}
          fuente={fuente}
          alDia={alDia}
          recargando={recargando}
          onReintentar={() => void cargarBase(true)}
        />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {fuente === 'excel' && (
            <p className="mb-4 flex items-start gap-1.5 border-l-4 border-resalte bg-resalte-fondo px-3 py-2 text-xs text-slate-700 print:hidden">
              <CloudOff className="w-3.5 h-3.5 mt-px shrink-0 text-resalte" aria-hidden="true" />
              <span>
                Sin conexión con el servidor: se muestran los datos de respaldo de {archivosRespaldo.join(' y ')}, no los de la base de
                datos. Las encuestas nuevas se podrán guardar cuando vuelva la conexión.
              </span>
            </p>
          )}
          {fuente === 'archivo' && (
            <div
              role="status"
              className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-4 border-resalte bg-resalte-fondo px-3 py-2 text-sm text-slate-800 print:hidden"
            >
              <span className="flex items-start gap-1.5">
                <FileSpreadsheet className="w-4 h-4 mt-0.5 shrink-0 text-resalte" aria-hidden="true" />
                Vista temporal: estos datos NO están guardados en la base de datos. Los análisis usan el archivo importado.
              </span>
              <button onClick={() => void cargarBase(true)} className="text-institucional hover:underline whitespace-nowrap self-start sm:self-auto">
                Volver a la base de datos
              </button>
            </div>
          )}
          <Suspense fallback={<p className="text-sm text-slate-500">Cargando…</p>}>
            {seccion === 'overview' && <TabOverview titulados={titulados} empleadores={empleadores} onNavigate={irA} />}

            {seccion === 'titulados' && <TabProfileGraduates titulados={titulados} />}

            {seccion === 'mercado' && <TabLaborMarket titulados={titulados} empleadores={empleadores} />}

            {seccion === 'curriculo' && <TabCurriculumEvaluation titulados={titulados} empleadores={empleadores} />}

            {seccion === 'estadistica' && <TabChiSquareAnalysis titulados={titulados} />}

            {seccion === 'simulacion' && <TabSimulationEngine titulados={titulados} />}

            {seccion === 'encuestas' && (
              <TabSurveysCollection
                titulados={titulados}
                empleadores={empleadores}
                onNavigate={irA}
                onSetTitulados={(nuevos) => {
                  setTitulados(nuevos);
                  setFuente('archivo');
                }}
                onSetEmpleadores={(nuevos) => {
                  setEmpleadores(nuevos);
                  setFuente('archivo');
                }}
                onSetItems={(nuevosItems: ItemEmpleador[]) => {
                  setItemsEmpleadores(nuevosItems);
                  setFuente('archivo');
                }}
                itemsCount={itemsEmpleadores.length}
                problemasBase={problemasBase}
                vistaTemporal={fuente === 'archivo'}
                onRecargar={() => cargarBase(true)}
              />
            )}

            {seccion === 'estrategia' && (
              <TabStrategicPlan titulados={titulados} empleadores={empleadores} onOpenReport={() => setReportModalOpen(true)} />
            )}

            {seccion === 'admin' && <PanelControl />}

            {seccion === 'admin_usuarios' && <AdminUsuarios usuarioActual={usuario} />}

            {(seccion === 'admin_titulados' || seccion === 'admin_empleadores') && (
              <div className="space-y-6">
                <EncabezadoPagina
                  titulo={seccion === 'admin_titulados' ? 'Titulados' : 'Empleadores'}
                  descripcion="Todos los registros de la base, con búsqueda, filtros y exportación a CSV o Excel."
                />
                <ExploradorDatos
                  key={seccion}
                  titulados={titulados}
                  empleadores={empleadores}
                  conjunto={seccion === 'admin_titulados' ? 'titulados' : 'empleadores'}
                  onNavigate={irA}
                />
              </div>
            )}

            {seccion === 'admin_dashboard' && <AccesosDashboard onNavigate={irA} />}
          </Suspense>
        </main>

        <footer className="mt-auto border-t border-slate-200 bg-white py-5 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <span className="font-semibold text-slate-700">{INFO_INSTITUCIONAL.universidad}</span>
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              <span>{INFO_INSTITUCIONAL.carrera}</span>
            </div>

            <div className="text-slate-400">
              {INFO_INSTITUCIONAL.materia} · {INFO_INSTITUCIONAL.grupo} · {INFO_INSTITUCIONAL.fecha}
            </div>
          </div>
        </footer>
      </div>

      {reportModalOpen && (
        <Suspense fallback={null}>
          <OfficialReportModal isOpen onClose={() => setReportModalOpen(false)} titulados={titulados} empleadores={empleadores} />
        </Suspense>
      )}
    </div>
  );
}
