/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, RotateCcw, CloudOff, ShieldAlert, X } from 'lucide-react';
import { Titulado, Empleador, ItemEmpleador } from './types';
import { cargarBaseReal, NOMBRE_BASE_REAL, type ProblemaImportacion } from './utils/importador';
import {
  avisarAlPerderSesion,
  cargarDesdeApi,
  cerrarSesion,
  ErrorApi,
  esFallaDelServidor,
  guardarEmpleador,
  guardarTitulado,
  obtenerSesion,
  type ResultadoGuardado
} from './utils/api';
import type { BorradorEmpleador, BorradorTitulado } from './utils/validacion';
import type { Usuario } from './utils/validacionUsuario';
import { esPestanaAdmin, NAVEGACION_ADMIN, Sidebar } from './components/Sidebar';
import { Header, type FuenteDatos } from './components/Header';
import { PantallaAcceso } from './components/PantallaAcceso';
import { EncabezadoPagina } from './components/ui/Estructura';
import { INFO_INSTITUCIONAL } from './data/strategicPlan';

// Cada pestaña se descarga al abrirla (Recharts y el resto del código no bloquean la carga inicial)
const TabOverview = lazy(() => import('./components/TabOverview').then((m) => ({ default: m.TabOverview })));
const TabProfileGraduates = lazy(() => import('./components/TabProfileGraduates').then((m) => ({ default: m.TabProfileGraduates })));
const TabLaborMarket = lazy(() => import('./components/TabLaborMarket').then((m) => ({ default: m.TabLaborMarket })));
const TabCurriculumEvaluation = lazy(() => import('./components/TabCurriculumEvaluation').then((m) => ({ default: m.TabCurriculumEvaluation })));
const TabChiSquareAnalysis = lazy(() => import('./components/TabChiSquareAnalysis').then((m) => ({ default: m.TabChiSquareAnalysis })));
const TabSimulationEngine = lazy(() => import('./components/TabSimulationEngine').then((m) => ({ default: m.TabSimulationEngine })));
const TabSurveysCollection = lazy(() => import('./components/TabSurveysCollection').then((m) => ({ default: m.TabSurveysCollection })));
const TabStrategicPlan = lazy(() => import('./components/TabStrategicPlan').then((m) => ({ default: m.TabStrategicPlan })));
const FormTituladosSurvey = lazy(() => import('./components/FormTituladosSurvey').then((m) => ({ default: m.FormTituladosSurvey })));
const FormEmpleadoresSurvey = lazy(() => import('./components/FormEmpleadoresSurvey').then((m) => ({ default: m.FormEmpleadoresSurvey })));
const ExploradorDatos = lazy(() => import('./components/ExploradorDatos').then((m) => ({ default: m.ExploradorDatos })));
const PanelControl = lazy(() => import('./components/admin/PanelControl').then((m) => ({ default: m.PanelControl })));
const AdminUsuarios = lazy(() => import('./components/admin/AdminUsuarios').then((m) => ({ default: m.AdminUsuarios })));
const AccesosDashboard = lazy(() => import('./components/admin/AccesosDashboard').then((m) => ({ default: m.AccesosDashboard })));
const OfficialReportModal = lazy(() => import('./components/OfficialReportModal').then((m) => ({ default: m.OfficialReportModal })));

/** Pestañas válidas; la activa se refleja en la URL (#titulados) para poder enlazarla. */
const PESTANAS = [
  'overview',
  'estrategia',
  'titulados',
  'mercado',
  'curriculo',
  'simulacion',
  'estadistica',
  'encuesta_titulados',
  'encuesta_empleadores',
  'encuestas',
  // Administración (solo administradores; un usuario normal vuelve a la portada)
  ...NAVEGACION_ADMIN.items.map((i) => i.id)
];
const pestanaDeUrl = () => {
  const hash = window.location.hash.slice(1);
  return PESTANAS.includes(hash) ? hash : 'overview';
};

const MENSAJE_SIN_PERMISOS = 'No tiene permisos para acceder a la sección de administración.';

export default function App() {
  // undefined: verificando la sesión; null: sin sesión (solo se muestran el login y el registro)
  const [usuario, setUsuario] = useState<Usuario | null>();
  const [avisoAcceso, setAvisoAcceso] = useState<string>();
  const [avisoPermisos, setAvisoPermisos] = useState<string>();
  const [activeTab, setActiveTab] = useState<string>(pestanaDeUrl);

  useEffect(() => {
    if (window.location.hash.slice(1) !== activeTab) window.history.pushState(null, '', `#${activeTab}`);
  }, [activeTab]);

  useEffect(() => {
    const alCambiar = () => setActiveTab(pestanaDeUrl());
    window.addEventListener('popstate', alCambiar);
    return () => window.removeEventListener('popstate', alCambiar);
  }, []);
  const [titulados, setTitulados] = useState<Titulado[]>([]);
  const [empleadores, setEmpleadores] = useState<Empleador[]>([]);
  const [itemsEmpleadores, setItemsEmpleadores] = useState<ItemEmpleador[]>([]);
  const [estadoCarga, setEstadoCarga] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [errorCarga, setErrorCarga] = useState<string>('');
  const [problemasBase, setProblemasBase] = useState<ProblemaImportacion[]>([]);
  // #informe abre directamente el informe imprimible
  const [reportModalOpen, setReportModalOpen] = useState<boolean>(() => window.location.hash === '#informe');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // 'api': datos de PostgreSQL; 'excel': respaldo local porque la API no respondió; 'archivo': un
  // archivo importado a mano en «Base de datos». El Header muestra siempre cuál está activa.
  const [fuente, setFuente] = useState<FuenteDatos>('api');
  // false si la última recarga en segundo plano falló: los datos a la vista pueden estar atrasados
  const [alDia, setAlDia] = useState(true);
  const [recargando, setRecargando] = useState(false);

  // Sesión: se consulta al abrir la web; si la API no responde se muestra el login con un aviso
  useEffect(() => {
    obtenerSesion().then(setUsuario, (err: unknown) => {
      setUsuario(null);
      setAvisoAcceso(err instanceof ErrorApi ? `${err.message} No es posible iniciar sesión por ahora.` : undefined);
    });
    // Una respuesta 401 de la API (sesión vencida, cuenta desactivada) vuelve al login
    avisarAlPerderSesion(() => {
      setUsuario(null);
      setAvisoAcceso('Su sesión terminó. Inicie sesión de nuevo.');
    });
    return () => avisarAlPerderSesion(undefined);
  }, []);

  const handleAutenticado = (u: Usuario) => {
    setAvisoAcceso(undefined);
    setUsuario(u);
  };

  const handleCerrarSesion = async () => {
    await cerrarSesion().catch(() => undefined);
    setUsuario(null);
    setAvisoAcceso(undefined);
    setAvisoPermisos(undefined);
    setReportModalOpen(false);
    window.history.replaceState(null, '', window.location.pathname);
    setActiveTab('overview');
  };

  // Navegación desde menús y enlaces: descarta el aviso de permisos
  const irA = useCallback((tab: string) => {
    setAvisoPermisos(undefined);
    setActiveTab(tab);
  }, []);

  // Un usuario que no es administrador no puede abrir las pestañas de Administración
  const esAdmin = usuario?.rol === 'admin';
  useEffect(() => {
    if (usuario && !esAdmin && esPestanaAdmin(activeTab)) {
      window.history.replaceState(null, '', '#overview');
      setAvisoPermisos(MENSAJE_SIN_PERMISOS);
      setActiveTab('overview');
    }
  }, [usuario, esAdmin, activeTab]);

  /**
   * Pide los datos a la API (solo con sesión). Según el error:
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
      setFuente('excel');
      setAlDia(true);
      setEstadoCarga('listo');
    } catch (err) {
      setErrorCarga(err instanceof Error ? err.message : String(err));
      setEstadoCarga('error');
    }
    return false;
  }, []);

  // Los datos se piden solo con sesión: al confirmarla con /api/auth/yo y en cada inicio de sesión.
  // Al cerrarla se descartan, para que el próximo usuario no vea los anteriores ni un instante.
  const usuarioId = usuario?.id;
  useEffect(() => {
    if (usuarioId !== undefined) {
      void cargarBase();
      return;
    }
    setTitulados([]);
    setEmpleadores([]);
    setItemsEmpleadores([]);
    setEstadoCarga('cargando');
  }, [usuarioId, cargarBase]);

  // Al volver a la pestaña se recargan los datos (otra persona pudo registrar encuestas mientras tanto),
  // salvo que se esté analizando un archivo importado a mano
  const hayDatos = usuarioId !== undefined && estadoCarga === 'listo';
  useEffect(() => {
    if (!hayDatos || fuente === 'archivo') return;
    const alVolver = () => {
      if (document.visibilityState === 'visible') void cargarBase(true);
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [hayDatos, fuente, cargarBase]);

  // La encuesta siempre se envía a la API (también desde el respaldo Excel, por si volvió la conexión)
  // y después se recargan los datos desde la base: el contador muestra lo que hay en PostgreSQL.
  // Nada se agrega solo en memoria: si no se pudo guardar, el formulario lo informa.
  const guardarYRecargar = async <T,>(guardar: () => Promise<ResultadoGuardado<T>>): Promise<ResultadoGuardado<T>> => {
    const r = await guardar();
    if (r.ok) await cargarBase(true);
    return r;
  };
  const handleGuardarTitulado = (b: BorradorTitulado) => guardarYRecargar(() => guardarTitulado(b));
  const handleGuardarEmpleador = (b: BorradorEmpleador) => guardarYRecargar(() => guardarEmpleador(b));

  if (usuario === undefined) {
    return (
      <div className="min-h-screen bg-slate-100/70 flex items-center justify-center p-6 font-sans">
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 text-sky-800 animate-spin" aria-hidden="true" />
          Verificando la sesión…
        </p>
      </div>
    );
  }

  if (usuario === null) {
    return <PantallaAcceso onAutenticado={handleAutenticado} aviso={avisoAcceso} />;
  }

  if (estadoCarga !== 'listo') {
    return (
      <div className="min-h-screen bg-slate-100/70 flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs max-w-md w-full text-center space-y-3">
          {estadoCarga === 'cargando' ? (
            <>
              <Loader2 className="w-6 h-6 text-sky-800 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-900">Cargando la base de datos real…</p>
              <p className="text-xs text-slate-500">Servidor PostgreSQL o, sin conexión, <span className="font-mono">{NOMBRE_BASE_REAL}</span></p>
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
      {/* Sidebar Navigation (Zero horizontal scrollbar) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={irA}
        onOpenReport={() => setReportModalOpen(true)}
        tituladosCount={titulados.length}
        empleadoresCount={empleadores.length}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        esAdmin={esAdmin}
      />

      {/* Main Workspace Area */}
      <div className={`flex-1 flex flex-col min-w-0 lg:pl-64 ${reportModalOpen ? 'print:hidden' : ''}`}>
        {/* Top Header with Breadcrumbs and Actions */}
        <Header
          activeTab={activeTab}
          onOpenReport={() => setReportModalOpen(true)}
          tituladosCount={titulados.length}
          empleadoresCount={empleadores.length}
          onToggleMobileMenu={() => setIsMobileSidebarOpen(true)}
          usuario={usuario}
          onCerrarSesion={() => void handleCerrarSesion()}
          fuente={fuente}
          alDia={alDia}
          recargando={recargando}
          onReintentar={() => void cargarBase(true)}
        />

        {/* Dynamic Content Viewport */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {avisoPermisos && (
            <div role="alert" className="mb-6 flex items-start justify-between gap-3 border-l-4 border-resalte bg-resalte-fondo px-4 py-3 text-sm text-slate-800 print:hidden">
              <span className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-resalte" aria-hidden="true" />
                {avisoPermisos}
              </span>
              <button onClick={() => setAvisoPermisos(undefined)} className="text-slate-500 hover:text-slate-800" aria-label="Cerrar aviso">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {fuente === 'excel' && (
            <p className="mb-4 flex items-start gap-1.5 border-l-4 border-resalte bg-resalte-fondo px-3 py-2 text-xs text-slate-700 print:hidden">
              <CloudOff className="w-3.5 h-3.5 mt-px shrink-0 text-resalte" aria-hidden="true" />
              <span>
                Sin conexión con el servidor: se muestran los datos de respaldo de {NOMBRE_BASE_REAL}, no los de la base de datos. Las
                encuestas nuevas se podrán guardar cuando vuelva la conexión.
              </span>
            </p>
          )}
          <Suspense fallback={<p className="text-sm text-slate-500">Cargando…</p>}>
          {activeTab === 'overview' && (
            <TabOverview titulados={titulados} empleadores={empleadores} onNavigate={irA} />
          )}

          {activeTab === 'titulados' && (
            <TabProfileGraduates titulados={titulados} />
          )}

          {activeTab === 'mercado' && (
            <TabLaborMarket titulados={titulados} empleadores={empleadores} />
          )}

          {activeTab === 'curriculo' && (
            <TabCurriculumEvaluation titulados={titulados} empleadores={empleadores} />
          )}

          {activeTab === 'estadistica' && (
            <TabChiSquareAnalysis titulados={titulados} />
          )}

          {activeTab === 'simulacion' && (
            <TabSimulationEngine titulados={titulados} />
          )}

          {activeTab === 'encuestas' && (
            <TabSurveysCollection
              titulados={titulados}
              empleadores={empleadores}
              onNavigate={irA}
              onSetTitulados={(newTitulados) => {
                setTitulados(newTitulados);
                setFuente('archivo');
              }}
              onSetEmpleadores={(newEmpleadores) => {
                setEmpleadores(newEmpleadores);
                setFuente('archivo');
              }}
              onSetItems={(nuevosItems: ItemEmpleador[]) => setItemsEmpleadores(nuevosItems)}
              itemsCount={itemsEmpleadores.length}
              problemasBase={problemasBase}
              onResetToOfficial={() => void cargarBase()}
            />
          )}

          {activeTab === 'encuesta_titulados' && (
            <FormTituladosSurvey
              onGuardarTitulado={handleGuardarTitulado}
              onNavigateToAnalytics={() => irA('titulados')}
              idsExistentes={titulados.map((t) => t.id)}
            />
          )}

          {activeTab === 'encuesta_empleadores' && (
            <FormEmpleadoresSurvey
              onGuardarEmpleador={handleGuardarEmpleador}
              onNavigateToAnalytics={() => irA('curriculo')}
              idsExistentes={empleadores.map((e) => e.id)}
            />
          )}

          {activeTab === 'estrategia' && (
            <TabStrategicPlan titulados={titulados} empleadores={empleadores} onOpenReport={() => setReportModalOpen(true)} />
          )}

          {/* Administración: solo se dibuja para administradores (la API también lo exige) */}
          {esAdmin && activeTab === 'admin' && <PanelControl />}

          {esAdmin && activeTab === 'admin_usuarios' && <AdminUsuarios usuarioActual={usuario} />}

          {esAdmin && (activeTab === 'admin_titulados' || activeTab === 'admin_empleadores') && (
            <div className="space-y-6">
              <EncabezadoPagina
                titulo={activeTab === 'admin_titulados' ? 'Titulados' : 'Empleadores'}
                descripcion="Todos los registros de la base, con búsqueda, filtros y exportación a CSV o Excel."
              />
              <ExploradorDatos
                key={activeTab}
                titulados={titulados}
                empleadores={empleadores}
                conjunto={activeTab === 'admin_titulados' ? 'titulados' : 'empleadores'}
                onNavigate={irA}
              />
            </div>
          )}

          {esAdmin && activeTab === 'admin_dashboard' && <AccesosDashboard onNavigate={irA} />}
          </Suspense>
        </main>

        {/* Quiet Footer */}
        <footer className="mt-auto border-t border-slate-200 bg-white py-5 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <span className="font-semibold text-slate-700">{INFO_INSTITUCIONAL.universidad}</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>{INFO_INSTITUCIONAL.carrera}</span>
            </div>

            <div className="text-slate-400">
              {INFO_INSTITUCIONAL.materia} · {INFO_INSTITUCIONAL.grupo} · {INFO_INSTITUCIONAL.fecha}
            </div>
          </div>
        </footer>
      </div>

      {/* Modal de Impresión de Informe Oficial */}
      {reportModalOpen && (
        <Suspense fallback={null}>
          <OfficialReportModal isOpen onClose={() => setReportModalOpen(false)} titulados={titulados} empleadores={empleadores} />
        </Suspense>
      )}
    </div>
  );
}
