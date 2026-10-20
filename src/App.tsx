/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { Titulado, Empleador, ItemEmpleador } from './types';
import { cargarBaseReal, NOMBRE_BASE_REAL, type ProblemaImportacion } from './utils/importador';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
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
  'encuestas'
];
const pestanaDeUrl = () => {
  const hash = window.location.hash.slice(1);
  return PESTANAS.includes(hash) ? hash : 'overview';
};

export default function App() {
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

  // Carga (o recarga) la base real incluida en public/data
  const cargarBase = useCallback(async () => {
    setEstadoCarga('cargando');
    try {
      const resultado = await cargarBaseReal();
      setTitulados(resultado.titulados ?? []);
      setEmpleadores(resultado.empleadores ?? []);
      setItemsEmpleadores(resultado.items ?? []);
      setProblemasBase(resultado.problemas);
      setEstadoCarga('listo');
    } catch (err) {
      setErrorCarga(err instanceof Error ? err.message : String(err));
      setEstadoCarga('error');
    }
  }, []);

  useEffect(() => {
    void cargarBase();
  }, [cargarBase]);

  const handleAddTitulado = (newT: Titulado) => {
    setTitulados((prev) => [newT, ...prev]);
  };

  const handleAddEmpleador = (newE: Empleador) => {
    setEmpleadores((prev) => [newE, ...prev]);
  };

  if (estadoCarga !== 'listo') {
    return (
      <div className="min-h-screen bg-slate-100/70 flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs max-w-md w-full text-center space-y-3">
          {estadoCarga === 'cargando' ? (
            <>
              <Loader2 className="w-6 h-6 text-sky-800 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-900">Cargando la base de datos real…</p>
              <p className="text-xs text-slate-500 font-mono">{NOMBRE_BASE_REAL}</p>
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
        setActiveTab={setActiveTab}
        onOpenReport={() => setReportModalOpen(true)}
        tituladosCount={titulados.length}
        empleadoresCount={empleadores.length}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
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
        />

        {/* Dynamic Content Viewport */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <Suspense fallback={<p className="text-sm text-slate-500">Cargando…</p>}>
          {activeTab === 'overview' && (
            <TabOverview titulados={titulados} empleadores={empleadores} onNavigate={(tab) => setActiveTab(tab)} />
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
              onNavigate={(tab) => setActiveTab(tab)}
              onSetTitulados={(newTitulados) => setTitulados(newTitulados)}
              onSetEmpleadores={(newEmpleadores) => setEmpleadores(newEmpleadores)}
              onSetItems={(nuevosItems: ItemEmpleador[]) => setItemsEmpleadores(nuevosItems)}
              itemsCount={itemsEmpleadores.length}
              problemasBase={problemasBase}
              onResetToOfficial={() => void cargarBase()}
            />
          )}

          {activeTab === 'encuesta_titulados' && (
            <FormTituladosSurvey
              onAddTitulado={handleAddTitulado}
              onNavigateToAnalytics={() => setActiveTab('titulados')}
              idsExistentes={titulados.map((t) => t.id)}
            />
          )}

          {activeTab === 'encuesta_empleadores' && (
            <FormEmpleadoresSurvey
              onAddEmpleador={handleAddEmpleador}
              onNavigateToAnalytics={() => setActiveTab('curriculo')}
              idsExistentes={empleadores.map((e) => e.id)}
            />
          )}

          {activeTab === 'estrategia' && (
            <TabStrategicPlan titulados={titulados} empleadores={empleadores} onOpenReport={() => setReportModalOpen(true)} />
          )}
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
