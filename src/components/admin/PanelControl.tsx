import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { ErrorApi, obtenerResumen, type ConteoOrigen, type ResumenAdmin } from '../../utils/api';
import { RegistrosPorDia } from '../graficos/RegistrosPorDia';
import { EncabezadoPagina, FilaKpi, Kpi, Nota, Panel } from '../ui/Estructura';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Panel de control de Administración: totales de /api/admin/resumen y registros por día. */
/** «184 de la base oficial · 2 por formulario» y, si hay, «· 5 importados». */
const origenes = (c: ConteoOrigen) =>
  [`${c.base_oficial} de la base oficial`, `${c.formulario} por formulario`, ...(c.importacion > 0 ? [`${c.importacion} importados`] : [])].join(' · ');

export function PanelControl() {
  const [resumen, setResumen] = useState<ResumenAdmin>();
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      setResumen(await obtenerResumen());
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar el resumen.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const ultimos = resumen?.ultimos_7_dias;

  return (
    <div className="space-y-6">
      <EncabezadoPagina
        titulo="Panel de control"
        descripcion="Cuentas de la web y encuestas registradas, con el detalle de los últimos 7 días."
        acciones={
          <button
            onClick={() => void cargar()}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-700 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-60"
          >
            {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Actualizar
          </button>
        }
      />

      {error && <Nota tono="resalte">{error}</Nota>}
      {!resumen && cargando && <p className="text-sm text-slate-500">Cargando…</p>}

      {resumen && ultimos && (
        <>
          <FilaKpi>
            <Kpi
              etiqueta="Usuarios"
              valor={String(resumen.usuarios.total)}
              contexto={`${plural(resumen.usuarios.admins, 'administrador', 'administradores')} · ${plural(resumen.usuarios.activos, 'activo', 'activos')}`}
            />
            <Kpi
              etiqueta="Titulados"
              valor={String(resumen.titulados.total)}
              contexto={origenes(resumen.titulados)}
            />
            <Kpi
              etiqueta="Empleadores"
              valor={String(resumen.empleadores.total)}
              contexto={origenes(resumen.empleadores)}
            />
            <Kpi
              etiqueta="Últimos 7 días"
              valor={plural(ultimos.titulados + ultimos.empleadores, 'encuesta', 'encuestas')}
              contexto={`${ultimos.titulados} de titulados · ${ultimos.empleadores} de empleadores · ${plural(ultimos.usuarios, 'cuenta nueva', 'cuentas nuevas')}`}
            />
          </FilaKpi>

          <Panel
            titulo="Encuestas registradas por día"
            interpretacion="Encuestas cargadas desde los formularios de la web en los últimos 7 días (hora de Bolivia). La base oficial no se cuenta."
            fuente="PostgreSQL, tablas titulados y empleadores (origen = formulario)"
          >
            <RegistrosPorDia dias={ultimos.por_dia} />
          </Panel>
        </>
      )}
    </div>
  );
}
