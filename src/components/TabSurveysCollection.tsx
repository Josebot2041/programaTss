import React, { useState } from 'react';
import { Titulado, Empleador, ItemEmpleador } from '../types';
import { DICCIONARIO_TITULADOS } from '../data/dictionary';
import { SECTORES } from '../data/catalogos';
import { importarArchivo, NOMBRE_BASE_REAL, type ProblemaImportacion } from '../utils/importador';
import { aCSV, aXlsx, descargar, filasEmpleadores, filasTitulados } from '../utils/exportador';
import {
  FileSpreadsheet,
  Search,
  Download,
  Upload,
  CheckCircle,
  RotateCcw,
  Database,
  AlertCircle,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

interface TabSurveysCollectionProps {
  titulados: Titulado[];
  empleadores: Empleador[];
  itemsCount: number;
  problemasBase: ProblemaImportacion[];
  onSetTitulados: (titulados: Titulado[]) => void;
  onSetEmpleadores: (empleadores: Empleador[]) => void;
  onSetItems: (items: ItemEmpleador[]) => void;
  onResetToOfficial: () => void;
  onNavigate: (tab: string) => void;
}

/** Máximo de problemas listados en pantalla (el total siempre se informa). */
const MAX_PROBLEMAS_VISIBLES = 50;

export const TabSurveysCollection: React.FC<TabSurveysCollectionProps> = ({
  titulados,
  empleadores,
  itemsCount,
  problemasBase,
  onSetTitulados,
  onSetEmpleadores,
  onSetItems,
  onResetToOfficial,
  onNavigate
}) => {
  const [subTab, setSubTab] = useState<'explorador' | 'importar' | 'diccionario' | 'wrangling'>('importar');
  const [activeDataSet, setActiveDataSet] = useState<'titulados' | 'empleadores'>('titulados');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSector, setFilterSector] = useState('Todos');

  // Estado de la última importación
  const [importNotice, setImportNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [problemasImportacion, setProblemasImportacion] = useState<ProblemaImportacion[]>([]);
  const [fuenteActiva, setFuenteActiva] = useState<string>(NOMBRE_BASE_REAL);

  const problemasVisibles = fuenteActiva === NOMBRE_BASE_REAL ? problemasBase : problemasImportacion;

  // Importación de un archivo .xlsx (libro con hojas Titulados / Empleadores) o .csv (una hoja)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    try {
      const resultado = await importarArchivo(await file.arrayBuffer(), file.name);
      const partes: string[] = [];
      if (resultado.titulados) {
        onSetTitulados(resultado.titulados);
        partes.push(`${resultado.titulados.length} titulados`);
      }
      if (resultado.empleadores) {
        onSetEmpleadores(resultado.empleadores);
        partes.push(`${resultado.empleadores.length} empleadores`);
      }
      if (resultado.items && resultado.items.length > 0) {
        onSetItems(resultado.items);
        partes.push(`${resultado.items.length} afirmaciones`);
      }
      setProblemasImportacion(resultado.problemas);

      const errores = resultado.problemas.filter((p) => p.severidad === 'error').length;
      const advertencias = resultado.problemas.length - errores;
      if (partes.length === 0) {
        setImportNotice({ message: `No se importó ningún registro de "${file.name}". Revise el detalle de problemas.`, type: 'error' });
      } else {
        setFuenteActiva(file.name);
        setImportNotice({
          message: `Se reemplazaron ${partes.join(', ')} con el archivo "${file.name}". ${errores} filas descartadas por error, ${advertencias} advertencias.`,
          type: 'success'
        });
      }
    } catch (err) {
      setProblemasImportacion([]);
      setImportNotice({
        message: `No se pudo leer "${file.name}": ${err instanceof Error ? err.message : String(err)}`,
        type: 'error'
      });
    }
  };

  const handleReset = () => {
    setFuenteActiva(NOMBRE_BASE_REAL);
    setProblemasImportacion([]);
    setImportNotice(null);
    onResetToOfficial();
  };

  // Exportación: CSV de la tabla activa (BOM + ";") o libro .xlsx completo
  const handleExportCSV = () => {
    const filas = activeDataSet === 'titulados' ? filasTitulados(titulados) : filasEmpleadores(empleadores);
    descargar(aCSV(filas), activeDataSet === 'titulados' ? 'Titulados_UMSS.csv' : 'Empleadores_UMSS.csv', 'text/csv;charset=utf-8');
  };
  const handleExportXlsx = async () => {
    descargar(await aXlsx(titulados, empleadores), 'Base_y_Resultados_UMSS.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  // Filtrado de titulados para la tabla
  const termino = searchTerm.toLowerCase();
  const filteredTitulados = titulados.filter((t) => {
    const matchesSearch =
      t.id.toLowerCase().includes(termino) ||
      (t.rubro?.toLowerCase().includes(termino) ?? false) ||
      (t.cargo?.toLowerCase().includes(termino) ?? false) ||
      (t.empresa?.toLowerCase().includes(termino) ?? false);
    const matchesSector = filterSector === 'Todos' || t.sector === filterSector;
    return matchesSearch && matchesSector;
  });
  const filteredEmpleadores = empleadores.filter(
    (e) => e.id.toLowerCase().includes(termino) || e.organizacion.toLowerCase().includes(termino)
  );

  const botonSubTab = (id: typeof subTab, contenido: React.ReactNode) => (
    <button
      onClick={() => setSubTab(id)}
      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
        subTab === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {contenido}
    </button>
  );

  return (
    <div className="space-y-8">
      {/* Sub-navegación contextual */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Carga de Archivos, Recolección & Base de Datos (Anexo C)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Importa la base de encuestas en Excel (.xlsx) o CSV y explora los registros cargados
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0 overflow-x-auto py-1">
          {botonSubTab('importar', <><Upload className="w-3.5 h-3.5" /><span>Cargar Archivos</span></>)}
          {botonSubTab('explorador', <>Explorador ({titulados.length} tit / {empleadores.length} emp)</>)}
          <button
            onClick={() => onNavigate('encuesta_titulados')}
            className="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap text-slate-600 hover:text-slate-900"
          >
            + Encuesta Titulado
          </button>
          <button
            onClick={() => onNavigate('encuesta_empleadores')}
            className="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap text-slate-600 hover:text-slate-900"
          >
            + Encuesta Empleador
          </button>
          {botonSubTab('diccionario', <>Diccionario</>)}
          {botonSubTab('wrangling', <>Reglas Limpieza</>)}
        </div>
      </div>

      {/* NOTIFICACIÓN DE ESTADO DE IMPORTACIÓN */}
      {importNotice && (
        <div className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between gap-3 ${
          importNotice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-rose-50 border-rose-200 text-rose-950'
        }`}>
          <div className="flex items-center gap-2">
            {importNotice.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{importNotice.message}</span>
          </div>
          <button onClick={() => setImportNotice(null)} className="text-slate-500 hover:text-slate-800 text-xs">✕</button>
        </div>
      )}

      {/* SUBTAB IMPORTAR ARCHIVOS */}
      {subTab === 'importar' && (
        <div className="space-y-6">
          {/* Base activa */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-4 h-4 text-sky-800" />
                <h3 className="text-sm font-bold text-slate-900">Base de Datos Activa</h3>
              </div>
              <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                Fuente: <code className="text-slate-800 font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">{fuenteActiva}</code>
                {' '}· {titulados.length} titulados · {empleadores.length} empleadores · {itemsCount} afirmaciones de empleadores
              </p>
            </div>

            <button
              onClick={handleReset}
              title={`Volver a cargar ${NOMBRE_BASE_REAL}`}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Recargar Base Real</span>
            </button>
          </div>

          {/* Carga de archivo del usuario */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-sky-800" />
              <h4 className="text-sm font-bold text-slate-900">Importar Archivo (.xlsx o .csv)</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              <strong>Excel:</strong> libro con hojas <code className="text-[11px]">Titulados</code>, <code className="text-[11px]">Empleadores</code> y/o{' '}
              <code className="text-[11px]">Items_empleadores</code>, con las mismas columnas que la base real.{' '}
              <strong>CSV:</strong> una sola hoja (titulados o empleadores), separada por punto y coma o coma.
              Los datos importados reemplazan a los actuales.
            </p>

            <div className="border-2 border-dashed border-slate-200 rounded-lg p-5 text-center bg-slate-50/60 hover:bg-slate-50 transition-colors">
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <label className="text-xs font-semibold text-sky-900 hover:underline cursor-pointer block">
                Seleccionar archivo
                <input
                  type="file"
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="hidden"
                  onChange={(e) => void handleFileUpload(e)}
                />
              </label>
              <span className="text-[11px] text-slate-400 block mt-1">Los valores que no correspondan al catálogo se informan y quedan sin respuesta</span>
            </div>
          </div>

          {/* Informe de problemas de la fuente activa */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              {problemasVisibles.length === 0 ? (
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              )}
              <h4 className="text-sm font-bold text-slate-900">
                Validación de la fuente activa: {problemasVisibles.length === 0 ? 'sin problemas' : `${problemasVisibles.length} problemas`}
              </h4>
            </div>

            {problemasVisibles.length > 0 && (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2">Hoja</th>
                      <th className="p-2 text-right">Fila</th>
                      <th className="p-2">Columna</th>
                      <th className="p-2">Valor</th>
                      <th className="p-2">Problema</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {problemasVisibles.slice(0, MAX_PROBLEMAS_VISIBLES).map((p, i) => (
                      <tr key={i} className={p.severidad === 'error' ? 'bg-rose-50/50' : ''}>
                        <td className="p-2">{p.hoja}</td>
                        <td className="p-2 text-right font-mono">{p.fila}</td>
                        <td className="p-2 font-mono">{p.columna ?? '—'}</td>
                        <td className="p-2 font-mono truncate max-w-xs">{p.valor ?? '—'}</td>
                        <td className="p-2">{p.mensaje}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {problemasVisibles.length > MAX_PROBLEMAS_VISIBLES && (
                  <div className="p-2 text-[11px] text-slate-500 text-right border-t border-slate-100">
                    Mostrando {MAX_PROBLEMAS_VISIBLES} de {problemasVisibles.length} problemas
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* EXPLORADOR DE DATOS */}
      {subTab === 'explorador' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveDataSet('titulados')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  activeDataSet === 'titulados' ? 'bg-sky-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Titulados ({titulados.length} registros)
              </button>
              <button
                onClick={() => setActiveDataSet('empleadores')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  activeDataSet === 'empleadores' ? 'bg-sky-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Empleadores ({empleadores.length} registros)
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar en la base..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-slate-50 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-sky-500 w-44 sm:w-56"
                />
              </div>

              {activeDataSet === 'titulados' && (
                <select
                  value={filterSector}
                  onChange={(e) => setFilterSector(e.target.value)}
                  className="text-xs border border-slate-200 rounded-md px-2.5 py-1.5 bg-slate-50 text-slate-700"
                >
                  <option value="Todos">Todos los sectores</option>
                  {SECTORES.map((s) => (
                    <option key={s} value={s}>Sector {s.toLowerCase()}</option>
                  ))}
                </select>
              )}

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </button>
              <button
                onClick={() => void handleExportXlsx()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Excel</span>
              </button>
            </div>
          </div>

          {/* Tabla de Titulados */}
          {activeDataSet === 'titulados' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">ID</th>
                    <th className="p-2.5">Edad</th>
                    <th className="p-2.5">Género</th>
                    <th className="p-2.5 text-right">Experiencia</th>
                    <th className="p-2.5">Segmento</th>
                    <th className="p-2.5">Situación Laboral</th>
                    <th className="p-2.5">Sector</th>
                    <th className="p-2.5">Rubro</th>
                    <th className="p-2.5">Remuneración</th>
                    <th className="p-2.5">Posgrado Interés</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredTitulados.slice(0, 50).map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-sky-950 font-sans">{t.id}</td>
                      <td className="p-2.5 font-sans">{t.edad}</td>
                      <td className="p-2.5 font-sans">{t.genero}</td>
                      <td className="p-2.5 text-right">{t.anios_vida_profesional !== undefined ? `${t.anios_vida_profesional} a.` : '—'}</td>
                      <td className="p-2.5 font-sans">
                        {t.segmento ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] ${t.segmento.startsWith('Junior') ? 'bg-sky-50 text-sky-800' : 'bg-slate-100 text-slate-800'}`}>
                            {t.segmento}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-2.5 font-sans truncate max-w-xs">{t.situacion_laboral}</td>
                      <td className="p-2.5 font-sans">{t.sector ?? '—'}</td>
                      <td className="p-2.5 font-sans">{t.rubro ?? '—'}</td>
                      <td className="p-2.5 font-sans">{t.remuneracion ?? '—'}</td>
                      <td className="p-2.5 font-sans font-semibold text-indigo-900">{t.area_interes ?? 'Sin interés'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-2.5 text-[11px] text-slate-500 text-right border-t border-slate-100">
                Mostrando primeros {Math.min(50, filteredTitulados.length)} de {filteredTitulados.length} registros
              </div>
            </div>
          )}

          {/* Tabla de Empleadores */}
          {activeDataSet === 'empleadores' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">ID</th>
                    <th className="p-2.5">Organización / Empresa</th>
                    <th className="p-2.5">Tipo</th>
                    <th className="p-2.5">Tamaño</th>
                    <th className="p-2.5">Rubro Principal</th>
                    <th className="p-2.5 text-center">Contrató 5a</th>
                    <th className="p-2.5">Posibilidad Contratación</th>
                    <th className="p-2.5">Nivel Exigido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredEmpleadores.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-sky-950">{e.id}</td>
                      <td className="p-2.5 font-semibold text-slate-900">{e.organizacion}</td>
                      <td className="p-2.5">{e.tipo}</td>
                      <td className="p-2.5">{e.tamano}</td>
                      <td className="p-2.5 truncate max-w-xs">{e.rubro ?? '—'}</td>
                      <td className="p-2.5 text-center font-mono font-bold text-slate-700">{e.contrato_5_anios ?? '—'}</td>
                      <td className="p-2.5">{e.posibilidad_contratacion ?? '—'}</td>
                      <td className="p-2.5 font-medium text-sky-900">{e.nivel_demandado ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={() => onNavigate(activeDataSet === 'titulados' ? 'encuesta_titulados' : 'encuesta_empleadores')}
            className="flex items-center gap-1.5 text-xs font-semibold text-sky-900 hover:underline"
          >
            <span>Registrar una nueva encuesta de {activeDataSet === 'titulados' ? 'titulado' : 'empleador'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* DICCIONARIO DE VARIABLES (Anexo C) */}
      {subTab === 'diccionario' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Anexo C. Diccionario de Datos Oficial (Base_Limpia_Titulados_Empleadores.xlsx)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Definición estandarizada de variables para interoperabilidad y auditoría ARCU-SUR
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Hoja 1: Titulados de Sistemas (Variables Categóricas, Numéricas y Likert)
            </h4>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Variable</th>
                    <th className="p-2.5">Nombre Descriptivo</th>
                    <th className="p-2.5">Tipo</th>
                    <th className="p-2.5">Descripción y Valores Observados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {DICCIONARIO_TITULADOS.map((v, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-sky-950">{v.codigo}</td>
                      <td className="p-2.5 font-medium text-slate-900">{v.nombre}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">
                          {v.tipo}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-600 max-w-md">
                        <div>{v.descripcion}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{v.valoresPosibles}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REGLAS DE LIMPIEZA / DATA WRANGLING (Sección 2.4.1) */}
      {subTab === 'wrangling' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            2.4.1 Limpieza de Datos (Data Wrangling Implementado en el Sistema)
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Protocolo de depuración aplicado a las bases brutas de Microsoft Forms y Google Forms
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-900 block">1. Normalización de Respuestas Numéricas</span>
              <p className="text-slate-600 leading-relaxed">
                Años de experiencia escritos como texto («2 años», «2 anios», «1.5», «6 meses») se convirtieron a tipo flotante en años (meses divididos entre 12).
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-900 block">2. Filtrado de Inconsistencias Lógicas</span>
              <p className="text-slate-600 leading-relaxed">
                Se anuló el tiempo de desempleo cuando superaba los años totales de vida profesional, y se descartaron registros sin sentido (por ejemplo, respuestas como «Vjbk»).
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-900 block">3. Eliminación de Registros de Prueba</span>
              <p className="text-slate-600 leading-relaxed">
                De las 53 respuestas iniciales de empleadores, dos registros de prueba con contenido vacío («lll», «G») fueron depurados, consolidando 51 respuestas válidas.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-900 block">4. Tratamiento de Selección Múltiple</span>
              <p className="text-slate-600 leading-relaxed">
                Las respuestas de varias opciones (aspectos útiles, asignaturas, cargos) almacenadas en una sola celda delimitadas por «;» fueron separadas en arrays normalizados.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
