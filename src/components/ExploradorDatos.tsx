import React, { useState } from 'react';
import { ArrowRight, Download, Search } from 'lucide-react';
import { Empleador, Titulado } from '../types';
import { SECTORES, TIPOS_ORGANIZACION } from '../data/catalogos';
import { aCSV, aXlsx, descargar, filasEmpleadores, filasTitulados } from '../utils/exportador';

type Conjunto = 'titulados' | 'empleadores';

const FILAS_POR_PAGINA = 50;

interface ExploradorDatosProps {
  titulados: Titulado[];
  empleadores: Empleador[];
  /** Si se indica, muestra solo esa tabla (sin el selector titulados / empleadores). */
  conjunto?: Conjunto;
  onNavigate: (tab: string) => void;
}

/**
 * Tablas de titulados y empleadores con búsqueda, filtros, paginación y exportación
 * (CSV de las filas filtradas o libro Excel completo con la hoja de resultados).
 * Lo usan la pestaña "Base de datos" y las tablas de Administración.
 */
export const ExploradorDatos: React.FC<ExploradorDatosProps> = ({ titulados, empleadores, conjunto, onNavigate }) => {
  const [elegido, setElegido] = useState<Conjunto>('titulados');
  const activo = conjunto ?? elegido;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSector, setFilterSector] = useState('Todos');
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [pagina, setPagina] = useState(1);

  const conFiltro = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPagina(1);
  };

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
    (e) =>
      (e.id.toLowerCase().includes(termino) || e.organizacion.toLowerCase().includes(termino) || (e.rubro?.toLowerCase().includes(termino) ?? false)) &&
      (filtroTipo === 'Todos' || e.tipo === filtroTipo)
  );

  const totalFiltrado = activo === 'titulados' ? filteredTitulados.length : filteredEmpleadores.length;
  const paginas = Math.max(1, Math.ceil(totalFiltrado / FILAS_POR_PAGINA));
  const paginaActual = Math.min(pagina, paginas);
  const desde = (paginaActual - 1) * FILAS_POR_PAGINA;
  const visibles = <T,>(filas: T[]) => filas.slice(desde, desde + FILAS_POR_PAGINA);

  // Exportación: CSV de las filas filtradas (BOM + ";") o libro .xlsx completo
  const handleExportCSV = () => {
    const filas = activo === 'titulados' ? filasTitulados(filteredTitulados) : filasEmpleadores(filteredEmpleadores);
    descargar(aCSV(filas), activo === 'titulados' ? 'Titulados_UMSS.csv' : 'Empleadores_UMSS.csv', 'text/csv;charset=utf-8');
  };
  const handleExportXlsx = async () => {
    descargar(await aXlsx(titulados, empleadores), 'Base_y_Resultados_UMSS.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  const botonConjunto = (id: Conjunto, texto: string) => (
    <button
      onClick={() => {
        setElegido(id);
        setPagina(1);
      }}
      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
        activo === id ? 'bg-sky-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {texto}
    </button>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
        {conjunto ? (
          <div className="text-sm text-slate-700">
            {totalFiltrado} de {activo === 'titulados' ? titulados.length : empleadores.length} registros
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {botonConjunto('titulados', `Titulados (${titulados.length} registros)`)}
            {botonConjunto('empleadores', `Empleadores (${empleadores.length} registros)`)}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Buscar en la base..."
              aria-label="Buscar en la base"
              value={searchTerm}
              onChange={(e) => conFiltro(setSearchTerm)(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-slate-50 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-sky-500 w-44 sm:w-56"
            />
          </div>

          {activo === 'titulados' ? (
            <select
              value={filterSector}
              onChange={(e) => conFiltro(setFilterSector)(e.target.value)}
              aria-label="Filtrar por sector"
              className="text-xs border border-slate-200 rounded-md px-2.5 py-1.5 bg-slate-50 text-slate-700"
            >
              <option value="Todos">Todos los sectores</option>
              {SECTORES.map((s) => (
                <option key={s} value={s}>Sector {s.toLowerCase()}</option>
              ))}
            </select>
          ) : (
            <select
              value={filtroTipo}
              onChange={(e) => conFiltro(setFiltroTipo)(e.target.value)}
              aria-label="Filtrar por tipo de organización"
              className="text-xs border border-slate-200 rounded-md px-2.5 py-1.5 bg-slate-50 text-slate-700"
            >
              <option value="Todos">Todos los tipos</option>
              {TIPOS_ORGANIZACION.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}

          <button
            onClick={handleExportCSV}
            title="Exporta las filas que cumplen la búsqueda y el filtro"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={() => void handleExportXlsx()}
            title="Exporta toda la base y la hoja de resultados"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Tabla de Titulados */}
      {activo === 'titulados' && (
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
              {visibles(filteredTitulados).map((t) => (
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
        </div>
      )}

      {/* Tabla de Empleadores */}
      {activo === 'empleadores' && (
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
              {visibles(filteredEmpleadores).map((e) => (
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
        <button
          onClick={() => onNavigate(activo === 'titulados' ? 'encuesta_titulados' : 'encuesta_empleadores')}
          className="flex items-center gap-1.5 text-xs font-semibold text-sky-900 hover:underline"
        >
          <span>Registrar una nueva encuesta de {activo === 'titulados' ? 'titulado' : 'empleador'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-3">
          <span>
            {totalFiltrado === 0 ? 'Sin registros' : `Mostrando ${desde + 1}–${Math.min(desde + FILAS_POR_PAGINA, totalFiltrado)} de ${totalFiltrado} registros`}
          </span>
          {paginas > 1 && (
            <span className="flex items-center gap-1">
              <button
                onClick={() => setPagina(paginaActual - 1)}
                disabled={paginaActual === 1}
                className="px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setPagina(paginaActual + 1)}
                disabled={paginaActual === paginas}
                className="px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Siguiente
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
