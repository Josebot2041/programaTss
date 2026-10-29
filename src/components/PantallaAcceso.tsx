import React, { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { INFO_INSTITUCIONAL } from '../data/strategicPlan';
import { ErrorApi, iniciarSesion, registrarse } from '../utils/api';
import type { Errores } from '../utils/validacion';
import { validarLogin, validarRegistro, type Usuario } from '../utils/validacionUsuario';
import { CampoContrasena, CampoTexto } from './ui/Formulario';

type Modo = 'login' | 'registro';

const VACIO = { nombre_completo: '', ci: '', password: '', confirmacion: '' };

/** Mensaje para el usuario ante un error de la API que no es de un campo. */
function mensajeDe(err: unknown): string {
  if (!(err instanceof ErrorApi)) return 'Ocurrió un error inesperado. Intente de nuevo.';
  if (err.estado === 0) return 'No se pudo conectar con el servidor. Verifique que la API esté en marcha e intente de nuevo.';
  if (err.estado >= 500) return 'El servidor no pudo procesar la solicitud. Intente de nuevo en unos minutos.';
  return err.message;
}

/**
 * Pantalla de acceso: "Iniciar sesión" (CI + contraseña) y "Crear cuenta". Es lo único que se ve
 * sin sesión. Valida en el navegador con las mismas reglas que la API y muestra los errores
 * que devuelve el servidor junto a cada campo.
 */
export function PantallaAcceso({ onAutenticado, aviso }: { onAutenticado: (usuario: Usuario) => void; aviso?: string }) {
  const [modo, setModo] = useState<Modo>(() => (typeof window !== 'undefined' && window.location.hash === '#registro' ? 'registro' : 'login'));
  const [datos, setDatos] = useState(VACIO);
  const [errores, setErrores] = useState<Errores>({});
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [intentado, setIntentado] = useState(false);

  const validar = (d: typeof datos, m: Modo) => (m === 'login' ? validarLogin(d) : validarRegistro(d)).errores;

  const cambiar = (campo: keyof typeof VACIO) => (valor: string) => {
    const nuevos = { ...datos, [campo]: valor };
    setDatos(nuevos);
    // Después del primer intento, los errores se actualizan mientras se escribe
    if (intentado) setErrores(validar(nuevos, modo));
  };

  const cambiarModo = (m: Modo) => {
    setModo(m);
    setErrores({});
    setMensaje('');
    setIntentado(false);
    setDatos((d) => ({ ...VACIO, ci: d.ci }));
    window.history.replaceState(null, '', m === 'registro' ? '#registro' : window.location.pathname);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntentado(true);
    setMensaje('');
    const encontrados = validar(datos, modo);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    setEnviando(true);
    try {
      const usuario = modo === 'login' ? await iniciarSesion(datos.ci, datos.password) : await registrarse(datos);
      onAutenticado(usuario);
    } catch (err) {
      if (err instanceof ErrorApi && Object.keys(err.errores).length > 0) setErrores(err.errores);
      else setMensaje(mensajeDe(err));
      setEnviando(false);
    }
  };

  const esLogin = modo === 'login';
  const avisoVisible = mensaje || aviso;

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="text-sm font-semibold text-slate-900">Ingeniería de Sistemas</div>
            <div className="text-xs text-slate-500">UMSS · Simulador de mercado y acreditación ARCU-SUR</div>
          </div>

          <section className="bg-white border border-slate-200 rounded-md p-6 space-y-5" aria-labelledby="titulo-acceso">
            <div>
              <h1 id="titulo-acceso" className="text-xl font-semibold text-slate-900">
                {esLogin ? 'Iniciar sesión' : 'Crear cuenta'}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {esLogin ? 'Ingrese con su CI y contraseña.' : 'Complete sus datos para acceder a la web.'}
              </p>
            </div>

            {avisoVisible && (
              <div role="alert" className="flex items-start gap-2 border-l-4 border-resalte bg-resalte-fondo px-3 py-2 text-sm text-slate-800">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-resalte" aria-hidden="true" />
                <span>{mensaje || aviso}</span>
              </div>
            )}

            <form onSubmit={(e) => void enviar(e)} noValidate className="space-y-4">
              {!esLogin && (
                <CampoTexto
                  id="nombre_completo"
                  etiqueta="Nombre completo"
                  valor={datos.nombre_completo}
                  onCambiar={cambiar('nombre_completo')}
                  error={errores.nombre_completo}
                  obligatorio
                  autoComplete="name"
                />
              )}
              <CampoTexto
                id="ci"
                etiqueta="CI"
                valor={datos.ci}
                onCambiar={cambiar('ci')}
                error={errores.ci}
                obligatorio
                autoComplete="username"
                ayuda={esLogin ? undefined : 'Solo números, con la extensión si la tiene (por ejemplo, 1234567 LP)'}
              />
              <CampoContrasena
                id="password"
                etiqueta="Contraseña"
                valor={datos.password}
                onCambiar={cambiar('password')}
                error={errores.password}
                autoComplete={esLogin ? 'current-password' : 'new-password'}
                ayuda={esLogin ? undefined : 'Al menos 8 caracteres, con una letra y un número'}
              />
              {!esLogin && (
                <CampoContrasena
                  id="confirmacion"
                  etiqueta="Confirmar contraseña"
                  valor={datos.confirmacion}
                  onCambiar={cambiar('confirmacion')}
                  error={errores.confirmacion}
                  autoComplete="new-password"
                />
              )}

              <button
                type="submit"
                disabled={enviando}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-institucional hover:bg-institucional/90 rounded disabled:opacity-60"
              >
                {enviando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                {enviando ? (esLogin ? 'Ingresando…' : 'Creando la cuenta…') : esLogin ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            </form>

            <p className="text-sm text-slate-600 text-center">
              {esLogin ? '¿No tiene una cuenta? ' : '¿Ya tiene una cuenta? '}
              <button type="button" onClick={() => cambiarModo(esLogin ? 'registro' : 'login')} className="text-institucional hover:underline">
                {esLogin ? 'Crear cuenta' : 'Iniciar sesión'}
              </button>
            </p>
          </section>
        </div>
      </main>

      <footer className="py-5 text-center text-xs text-slate-500">
        {INFO_INSTITUCIONAL.universidad} · {INFO_INSTITUCIONAL.carrera}
      </footer>
    </div>
  );
}
