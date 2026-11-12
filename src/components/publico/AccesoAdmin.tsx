import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { ErrorApi, iniciarSesion } from '../../utils/api';
import type { Errores } from '../../utils/validacion';
import { validarLogin, type Usuario } from '../../utils/validacionUsuario';
import { CampoContrasena, CampoTexto } from '../ui/Formulario';
import { AvisoNoDisponible, PaginaPublica, useEstadoApi, VolverAlInicio } from './Publico';

/** Mensaje para el usuario ante un error de la API que no es de un campo. */
function mensajeDe(err: unknown): string {
  if (!(err instanceof ErrorApi)) return 'Ocurrió un error inesperado. Intente de nuevo.';
  if (err.estado === 0) return 'No se pudo conectar con el servidor. Verifique que la API esté en marcha e intente de nuevo.';
  if (err.estado >= 500) return 'El servidor no pudo procesar la solicitud. Intente de nuevo en unos minutos.';
  return err.message;
}

/**
 * Acceso de administradores (CI y contraseña). La API solo inicia sesión a administradores
 * activos; a cualquier otra cuenta le responde «No tiene permisos de administrador».
 * Los administradores se crean con npm run crear-admin.
 */
export function AccesoAdmin({ onAutenticado, onVolver, aviso }: { onAutenticado: (usuario: Usuario) => void; onVolver: () => void; aviso?: string }) {
  const [datos, setDatos] = useState({ ci: '', password: '' });
  const [errores, setErrores] = useState<Errores>({});
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [intentado, setIntentado] = useState(false);
  // Sin la API no se puede iniciar sesión: el formulario se deshabilita
  const sinApi = useEstadoApi() === 'no_disponible';

  const cambiar = (campo: 'ci' | 'password') => (valor: string) => {
    const nuevos = { ...datos, [campo]: valor };
    setDatos(nuevos);
    // Después del primer intento, los errores se actualizan mientras se escribe
    if (intentado) setErrores(validarLogin(nuevos).errores);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntentado(true);
    setMensaje('');
    const encontrados = validarLogin(datos).errores;
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    setEnviando(true);
    try {
      onAutenticado(await iniciarSesion(datos.ci, datos.password));
    } catch (err) {
      if (err instanceof ErrorApi && Object.keys(err.errores).length > 0) setErrores(err.errores);
      else setMensaje(mensajeDe(err));
      setEnviando(false);
    }
  };

  const avisoVisible = mensaje || aviso;

  return (
    <PaginaPublica ancho="max-w-sm">
      <div className="mb-6">
        <VolverAlInicio onVolver={onVolver} />
      </div>

      <section className="bg-white border border-slate-200 rounded-md p-6 space-y-5" aria-labelledby="titulo-acceso">
        <div>
          <h1 id="titulo-acceso" className="text-xl font-semibold text-slate-900">
            Acceso administrador
          </h1>
          <p className="mt-1 text-sm text-slate-600">Ingrese con su CI y contraseña para abrir el panel de análisis.</p>
        </div>

        {sinApi && <AvisoNoDisponible>El acceso al panel no está disponible en este momento.</AvisoNoDisponible>}

        {avisoVisible && !sinApi && (
          <div role="alert" className="flex items-start gap-2 border-l-4 border-resalte bg-resalte-fondo px-3 py-2 text-sm text-slate-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-resalte" aria-hidden="true" />
            <span>{mensaje || aviso}</span>
          </div>
        )}

        <form onSubmit={(e) => void enviar(e)} noValidate className="space-y-4">
          <fieldset disabled={sinApi} className="space-y-4 disabled:opacity-60">
            <CampoTexto id="ci" etiqueta="CI" valor={datos.ci} onCambiar={cambiar('ci')} error={errores.ci} obligatorio autoComplete="username" />
            <CampoContrasena
              id="password"
              etiqueta="Contraseña"
              valor={datos.password}
              onCambiar={cambiar('password')}
              error={errores.password}
              autoComplete="current-password"
            />
            <button
              type="submit"
              disabled={enviando}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded disabled:opacity-60"
            >
              {enviando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {enviando ? 'Ingresando…' : 'Iniciar sesión'}
            </button>
          </fieldset>
        </form>
      </section>
    </PaginaPublica>
  );
}
