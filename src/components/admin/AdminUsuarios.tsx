import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { actualizarUsuario, eliminarUsuario, ErrorApi, listarUsuarios, type PaginaUsuarios } from '../../utils/api';
import type { Usuario } from '../../utils/validacionUsuario';
import { EncabezadoPagina, Nota } from '../ui/Estructura';

const POR_PAGINA = 20;

const fechaHora = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/La_Paz' })
    : 'Nunca';

const plural = (n: number) => `${n} ${n === 1 ? 'cuenta' : 'cuentas'}`;

const mensajeDe = (err: unknown) => (err instanceof ErrorApi ? err.message : 'No se pudo completar la acción.');

/**
 * Usuarios de la web: búsqueda por nombre o CI, rol, estado, último acceso y acciones.
 * El administrador no puede cambiarse a sí mismo (la API también lo impide).
 */
export function AdminUsuarios({ usuarioActual }: { usuarioActual: Usuario }) {
  const [buscar, setBuscar] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<PaginaUsuarios>();
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string }>();
  const [ocupado, setOcupado] = useState<number>();
  const [porEliminar, setPorEliminar] = useState<Usuario>();
  const consulta = useRef(0);

  const cargar = useCallback(async (texto: string, p: number) => {
    const n = ++consulta.current;
    setCargando(true);
    try {
      const resultado = await listarUsuarios(texto, p, POR_PAGINA);
      if (n === consulta.current) setDatos(resultado);
    } catch (err) {
      if (n === consulta.current) setAviso({ tono: 'error', texto: mensajeDe(err) });
    } finally {
      if (n === consulta.current) setCargando(false);
    }
  }, []);

  // La búsqueda espera a que se deje de escribir
  useEffect(() => {
    const espera = setTimeout(() => void cargar(buscar, pagina), 250);
    return () => clearTimeout(espera);
  }, [buscar, pagina, cargar]);

  const aplicar = async (u: Usuario, cambios: { activo?: boolean; rol?: 'usuario' | 'admin' }, texto: string) => {
    setOcupado(u.id);
    setAviso(undefined);
    try {
      const actualizado = await actualizarUsuario(u.id, cambios);
      setDatos((d) => d && { ...d, usuarios: d.usuarios.map((x) => (x.id === u.id ? actualizado : x)) });
      setAviso({ tono: 'ok', texto });
    } catch (err) {
      setAviso({ tono: 'error', texto: mensajeDe(err) });
    } finally {
      setOcupado(undefined);
    }
  };

  const confirmarEliminar = async () => {
    if (!porEliminar) return;
    const u = porEliminar;
    setOcupado(u.id);
    setAviso(undefined);
    try {
      await eliminarUsuario(u.id);
      setPorEliminar(undefined);
      setAviso({ tono: 'ok', texto: `Se eliminó la cuenta de ${u.nombre_completo}.` });
      // Si era la última fila de la página, vuelve a la anterior
      const quedan = (datos?.usuarios.length ?? 1) - 1;
      if (quedan === 0 && pagina > 1) setPagina(pagina - 1);
      else void cargar(buscar, pagina);
    } catch (err) {
      setPorEliminar(undefined);
      setAviso({ tono: 'error', texto: mensajeDe(err) });
    } finally {
      setOcupado(undefined);
    }
  };

  const total = datos?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const desde = (pagina - 1) * POR_PAGINA;
  const boton = 'px-2 py-1 text-xs rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white';

  return (
    <div className="space-y-6">
      <EncabezadoPagina titulo="Usuarios" descripcion="Cuentas de acceso a la web. Los administradores nuevos se crean con npm run crear-admin o promoviendo una cuenta." />

      {aviso && (
        <div role={aviso.tono === 'error' ? 'alert' : 'status'}>
          {aviso.tono === 'error' ? (
            <Nota tono="resalte">{aviso.texto}</Nota>
          ) : (
            <Nota>{aviso.texto}</Nota>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-md p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" aria-hidden="true" />
            <input
              type="search"
              value={buscar}
              onChange={(e) => {
                setBuscar(e.target.value);
                setPagina(1);
              }}
              placeholder="Buscar por nombre o CI"
              aria-label="Buscar por nombre o CI"
              className="pl-8 pr-3 py-2 text-sm border border-slate-300 rounded w-full sm:w-72 focus:outline-none focus:ring-1 focus:ring-institucional"
            />
          </div>
          <div className="text-sm text-slate-600 flex items-center gap-2">
            {cargando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {plural(total)}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2 pr-3 font-medium">Nombre</th>
                <th className="py-2 pr-3 font-medium">CI</th>
                <th className="py-2 pr-3 font-medium">Rol</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 pr-3 font-medium">Último acceso</th>
                <th className="py-2 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {datos?.usuarios.map((u) => {
                const propio = u.id === usuarioActual.id;
                const deshabilitado = propio || ocupado !== undefined;
                return (
                  <tr key={u.id} className="align-middle">
                    <td className="py-2 pr-3 text-slate-900">
                      {u.nombre_completo}
                      {propio && <span className="ml-1.5 text-xs text-slate-500">(usted)</span>}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-slate-700">{u.ci}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${u.rol === 'admin' ? 'bg-institucional-fondo text-institucional' : 'bg-slate-100 text-slate-700'}`}>
                        {u.rol === 'admin' ? 'Administrador' : 'Usuario'}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs ${u.activo ? 'text-slate-700' : 'text-resalte font-medium'}`}>{u.activo ? 'Activo' : 'Desactivado'}</span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600 tabular-nums whitespace-nowrap">{fechaHora(u.ultimo_acceso)}</td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1.5 whitespace-nowrap">
                        <button
                          className={boton}
                          disabled={deshabilitado}
                          onClick={() =>
                            void aplicar(u, { activo: !u.activo }, `${u.nombre_completo} quedó ${u.activo ? 'desactivado' : 'activo'}.`)
                          }
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          className={boton}
                          disabled={deshabilitado}
                          onClick={() =>
                            void aplicar(
                              u,
                              { rol: u.rol === 'admin' ? 'usuario' : 'admin' },
                              u.rol === 'admin' ? `${u.nombre_completo} ya no es administrador.` : `${u.nombre_completo} ahora es administrador.`
                            )
                          }
                        >
                          {u.rol === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                        </button>
                        <button
                          className={`${boton} text-resalte border-resalte/40 hover:bg-resalte-fondo`}
                          disabled={deshabilitado}
                          onClick={() => setPorEliminar(u)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {datos && datos.usuarios.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    {buscar ? 'Ninguna cuenta coincide con la búsqueda.' : 'Todavía no hay cuentas.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {total > POR_PAGINA && (
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Mostrando {desde + 1}–{Math.min(desde + POR_PAGINA, total)} de {total}
            </span>
            <span className="flex gap-1.5">
              <button className={boton} disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>
                Anterior
              </button>
              <button className={boton} disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>
                Siguiente
              </button>
            </span>
          </div>
        )}
      </div>

      {porEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-eliminar" className="w-full max-w-sm bg-white border border-slate-200 rounded-md p-5 space-y-4">
            <h2 id="titulo-eliminar" className="text-base font-semibold text-slate-900">
              ¿Eliminar la cuenta?
            </h2>
            <p className="text-sm text-slate-600">
              Se eliminará la cuenta de <strong className="text-slate-900">{porEliminar.nombre_completo}</strong> (CI {porEliminar.ci}) y se
              cerrarán sus sesiones. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                autoFocus
                onClick={() => setPorEliminar(undefined)}
                className="px-3 py-1.5 text-sm rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void confirmarEliminar()}
                disabled={ocupado !== undefined}
                className="px-3 py-1.5 text-sm rounded bg-resalte text-white hover:bg-resalte/90 disabled:opacity-60"
              >
                Eliminar cuenta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
