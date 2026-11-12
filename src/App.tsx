/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { avisarAlPerderSesion, cerrarSesion, ErrorApi, obtenerSesion } from './utils/api';
import type { Usuario } from './utils/validacionUsuario';
import { hashDeRuta, rutaDeHash, SECCION_INICIAL, type Ruta } from './rutas';
import { PortadaPublica } from './components/publico/PortadaPublica';
import { EncuestaPublica } from './components/publico/EncuestaPublica';
import { AccesoAdmin } from './components/publico/AccesoAdmin';
import { Panel, type DestinoExterno } from './components/Panel';

const MENSAJE_SIN_PERMISOS = 'No tiene permisos de administrador';
const PANEL_INICIAL: Ruta = { vista: 'panel', seccion: SECCION_INICIAL };

function Verificando() {
  return (
    <div className="min-h-screen bg-slate-100/70 flex items-center justify-center p-6 font-sans">
      <p className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="w-4 h-4 text-sky-800 animate-spin" aria-hidden="true" />
        Verificando la sesión…
      </p>
    </div>
  );
}

/**
 * Enrutador de la web (ver src/rutas.ts): portada y encuestas públicas, acceso de administrador
 * y panel de análisis. El panel exige una sesión de administrador; sin ella, cualquier ruta del
 * panel lleva al login y, al entrar, se abre la sección pedida.
 */
export default function App() {
  const [ruta, setRuta] = useState<Ruta>(() => rutaDeHash(window.location.hash));
  // undefined: sin consultar todavía; null: sin sesión de administrador
  const [usuario, setUsuario] = useState<Usuario | null>();
  const [aviso, setAviso] = useState<string>();
  // Sección del panel pedida sin sesión: se abre después del login
  const [destino, setDestino] = useState<Ruta>();

  const navegar = useCallback((nueva: Ruta, reemplazar = false) => {
    const url = hashDeRuta(nueva) || window.location.pathname + window.location.search;
    if (reemplazar) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    setRuta(nueva);
  }, []);

  // Atrás / adelante del navegador y enlaces con hash (las tarjetas de la portada)
  useEffect(() => {
    const alCambiar = () => setRuta(rutaDeHash(window.location.hash));
    window.addEventListener('popstate', alCambiar);
    window.addEventListener('hashchange', alCambiar);
    return () => {
      window.removeEventListener('popstate', alCambiar);
      window.removeEventListener('hashchange', alCambiar);
    };
  }, []);

  // Cada página nueva empieza arriba (cambiar de sección dentro del panel no cuenta)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [ruta.vista]);

  // La sesión se consulta al entrar al panel o al login; la portada y las encuestas no la usan
  const necesitaSesion = ruta.vista === 'panel' || ruta.vista === 'admin-login';
  useEffect(() => {
    if (!necesitaSesion || usuario !== undefined) return;
    let vigente = true;
    obtenerSesion().then(
      (u) => {
        if (!vigente) return;
        // Una sesión de una cuenta que ya no es admin (de antes del rediseño) no abre el panel
        if (u && u.rol !== 'admin') {
          void cerrarSesion().catch(() => undefined);
          setAviso(MENSAJE_SIN_PERMISOS);
          setUsuario(null);
        } else {
          setUsuario(u);
        }
      },
      (err: unknown) => {
        if (!vigente) return;
        setUsuario(null);
        setAviso(err instanceof ErrorApi ? `${err.message} No es posible iniciar sesión por ahora.` : undefined);
      }
    );
    return () => {
      vigente = false;
    };
  }, [necesitaSesion, usuario]);

  // Una respuesta 401 de la API (sesión vencida, cuenta desactivada) vuelve al login
  useEffect(() => {
    avisarAlPerderSesion(() => {
      setUsuario(null);
      setAviso('Su sesión terminó. Inicie sesión de nuevo.');
    });
    return () => avisarAlPerderSesion(undefined);
  }, []);

  const esAdmin = usuario?.rol === 'admin';

  // Sin sesión de admin, el panel lleva al login; con sesión, el login lleva al panel
  useEffect(() => {
    if (usuario === undefined) return;
    if (ruta.vista === 'panel' && !esAdmin) {
      setDestino(ruta);
      navegar({ vista: 'admin-login' }, true);
    } else if (ruta.vista === 'admin-login' && esAdmin) {
      navegar(destino ?? PANEL_INICIAL, true);
      setDestino(undefined);
    }
  }, [ruta, usuario, esAdmin, destino, navegar]);

  const autenticado = (u: Usuario) => {
    setAviso(undefined);
    setUsuario(u);
  };

  const cerrar = async () => {
    await cerrarSesion().catch(() => undefined);
    setUsuario(null);
    setAviso(undefined);
    setDestino(undefined);
    navegar({ vista: 'portada' });
  };

  const irPortada = () => navegar({ vista: 'portada' });

  if (ruta.vista === 'portada') return <PortadaPublica />;

  if (ruta.vista === 'encuesta-titulados' || ruta.vista === 'encuesta-empleadores') {
    return <EncuestaPublica key={ruta.vista} tipo={ruta.vista === 'encuesta-titulados' ? 'titulados' : 'empleadores'} onVolver={irPortada} />;
  }

  // Mientras se consulta la sesión o se redirige
  if (usuario === undefined || (ruta.vista === 'panel' && !esAdmin) || (ruta.vista === 'admin-login' && esAdmin)) {
    return <Verificando />;
  }

  if (ruta.vista === 'admin-login') return <AccesoAdmin onAutenticado={autenticado} onVolver={irPortada} aviso={aviso} />;

  return (
    <Panel
      usuario={usuario!}
      seccion={ruta.seccion}
      informeInicial={ruta.informe}
      onSeccion={(seccion) => navegar({ vista: 'panel', seccion })}
      onSalir={(d: DestinoExterno) => navegar({ vista: d })}
      onCerrarSesion={() => void cerrar()}
    />
  );
}
