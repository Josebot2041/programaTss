/**
 * Prueba de humo: cada pestaña y formulario se renderiza sin errores con la base real.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { leerBaseRealLocal } from '../utils/baseRealLocal';
import { FormEmpleadoresSurvey } from './FormEmpleadoresSurvey';
import { FormTituladosSurvey } from './FormTituladosSurvey';
import { Header } from './Header';
import { OfficialReportModal } from './OfficialReportModal';
import { Sidebar } from './Sidebar';
import { TabChiSquareAnalysis } from './TabChiSquareAnalysis';
import { TabCurriculumEvaluation } from './TabCurriculumEvaluation';
import { TabLaborMarket } from './TabLaborMarket';
import { TabOverview } from './TabOverview';
import { TabProfileGraduates } from './TabProfileGraduates';
import { TabSimulationEngine } from './TabSimulationEngine';
import { TabStrategicPlan } from './TabStrategicPlan';
import { TabSurveysCollection } from './TabSurveysCollection';
import { ExploradorDatos } from './ExploradorDatos';
import { PantallaAcceso } from './PantallaAcceso';
import { AccesosDashboard } from './admin/AccesosDashboard';
import { AdminUsuarios } from './admin/AdminUsuarios';
import { PanelControl } from './admin/PanelControl';
import { RegistrosPorDia } from './graficos/RegistrosPorDia';
import type { Usuario } from '../utils/validacionUsuario';

const base = await leerBaseRealLocal();
const titulados = base.titulados ?? [];
const empleadores = base.empleadores ?? [];
const nada = () => undefined;
const guardarNada = async () => ({ ok: false as const, errores: {} });
const admin: Usuario = {
  id: 1,
  nombre_completo: 'Ana Quispe',
  ci: '1234567 LP',
  rol: 'admin',
  activo: true,
  created_at: '2026-10-29T12:00:00.000Z',
  ultimo_acceso: null
};

const pantallas: Array<[string, React.ReactElement]> = [
  ['Sidebar', <Sidebar activeTab="overview" setActiveTab={nada} onOpenReport={nada} tituladosCount={148} empleadoresCount={51} isOpenMobile={false} onCloseMobile={nada} />],
  ['Header', <Header activeTab="overview" onOpenReport={nada} tituladosCount={148} empleadoresCount={51} onToggleMobileMenu={nada} />],
  ['Portada', <TabOverview titulados={titulados} empleadores={empleadores} onNavigate={nada} />],
  ['Perfil de titulados', <TabProfileGraduates titulados={titulados} />],
  ['Mercado laboral', <TabLaborMarket titulados={titulados} empleadores={empleadores} />],
  ['Valoración curricular', <TabCurriculumEvaluation titulados={titulados} empleadores={empleadores} />],
  ['Chi-cuadrado', <TabChiSquareAnalysis titulados={titulados} />],
  ['Simulación', <TabSimulationEngine titulados={titulados} />],
  ['Plan estratégico', <TabStrategicPlan titulados={titulados} empleadores={empleadores} onOpenReport={nada} />],
  [
    'Base de datos',
    <TabSurveysCollection
      titulados={titulados}
      empleadores={empleadores}
      itemsCount={base.items?.length ?? 0}
      problemasBase={base.problemas}
      onSetTitulados={nada}
      onSetEmpleadores={nada}
      onSetItems={nada}
      onResetToOfficial={nada}
      onNavigate={nada}
    />
  ],
  ['Encuesta titulados', <FormTituladosSurvey onGuardarTitulado={guardarNada} onNavigateToAnalytics={nada} idsExistentes={titulados.map((t) => t.id)} />],
  ['Encuesta empleadores', <FormEmpleadoresSurvey onGuardarEmpleador={guardarNada} onNavigateToAnalytics={nada} idsExistentes={empleadores.map((e) => e.id)} />],
  ['Informe imprimible', <OfficialReportModal isOpen onClose={nada} titulados={titulados} empleadores={empleadores} />],
  ['Sidebar de administrador', <Sidebar activeTab="admin" setActiveTab={nada} onOpenReport={nada} tituladosCount={148} empleadoresCount={51} isOpenMobile={false} onCloseMobile={nada} esAdmin />],
  ['Header con sesión', <Header activeTab="admin_usuarios" onOpenReport={nada} tituladosCount={148} empleadoresCount={51} onToggleMobileMenu={nada} usuario={admin} onCerrarSesion={nada} />],
  ['Iniciar sesión', <PantallaAcceso onAutenticado={nada} aviso="Su sesión terminó." />],
  ['Panel de control', <PanelControl />],
  ['Usuarios', <AdminUsuarios usuarioActual={admin} />],
  ['Tabla de empleadores', <ExploradorDatos titulados={titulados} empleadores={empleadores} conjunto="empleadores" onNavigate={nada} />],
  ['Dashboard', <AccesosDashboard onNavigate={nada} />],
  [
    'Registros por día',
    <RegistrosPorDia dias={[{ fecha: '2026-10-28', titulados: 2, empleadores: 1 }, { fecha: '2026-10-29', titulados: 0, empleadores: 0 }]} />
  ]
];

/** Texto visible de un elemento renderizado (sin etiquetas HTML). */
const textoVisible = (elemento: React.ReactElement) =>
  renderToStaticMarkup(elemento)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ');

describe('Perfil de los titulados: textos generados con los datos', () => {
  const texto = textoVisible(<TabProfileGraduates titulados={titulados} />);

  it.each([
    '5 años',
    'Q1 2 · Q3 14',
    'La media supera a la mediana porque 13 titulados (8.7%) tienen más de 20 años de trayectoria.',
    'Los junior promedian 1.90 años y los consolidados 13.99 años.',
    'El grupo más numeroso es el de 35 años o más (42.8%).',
    'El 77.6% son hombres y el 22.4% mujeres.',
    'El 49.3% acumula menos de un año sin empleo.',
    'Mediana del tiempo cesante sobre 146 titulados, incluidos los ceros 1 años',
    'Desempleo sobre la trayectoria años sin empleo / años de vida profesional 9.3%',
    'Nunca estuvo desempleado 60 de 146 41.1%',
    'Interés en un posgrado 82.8% 125 de 151',
    'Las dos áreas principales (IA e Ingeniería de Software) suman 68.3% de las preferencias, cerca del umbral de alerta de 70%.',
    'Base de Datos (7.9%) y Robótica (4.0%) tienen baja demanda como programas independientes.',
    'Universidades internacionales es la segunda opción (24.6%); la UMSS (Posgrado FCyT y EUPG) reúne el 42.1%.',
    'Diplomado y maestría suman 95.0% de los programas cursados.',
    'El 91.1% lo pagó con recursos propios.'
  ])('muestra: %s', (frase) => {
    expect(texto).toContain(frase);
  });

  it('no repite en la línea del gráfico el porcentaje de la nota de umbral', () => {
    expect(texto.split('68.3%')).toHaveLength(2);
  });

  it('no deja cifras del informe escritas a mano', () => {
    expect(texto).not.toContain('Concentración Crítica');
    expect(texto).not.toContain('Valor Oficial');
  });
});

describe('Pruebas de independencia: textos generados con los datos', () => {
  const texto = textoVisible(<TabChiSquareAnalysis titulados={titulados} />);

  it.each([
    '1 de 4 relaciones es significativa: sector × remuneración mensual.',
    '1.532 (0.2159)',
    '8.934 (0.1773)',
    '4.385 (0.0363)',
    'Pagaron con recursos propios 65 de 69 en Diplomado (94.2%) y 27 de 32 en Especialidad, Maestría o Doctorado (84.4%).',
    'Prueba exacta de Fisher Resultado oficial p = 0.1374',
    '1 de 4 celdas tiene frecuencia esperada menor que 5 (mínima 2.85): por eso el resultado oficial es la prueba exacta de Fisher.',
    'No se rechaza H₀ (p = 0.1374 ≥ 0.05): no hay evidencia de asociación entre nivel del programa y financiamiento.',
    'La UMSS es la institución preferida en 4 de 5 áreas; la excepción es Redes de Datos y Seguridad.'
  ])('muestra: %s', (frase) => {
    expect(texto).toContain(frase);
  });

  it('ya no usa la etiqueta "27/32 maestrías"', () => {
    expect(texto).not.toContain('maestrías');
  });
});

describe('Plan de estudios: textos generados con los datos', () => {
  const texto = textoVisible(<TabCurriculumEvaluation titulados={titulados} empleadores={empleadores} />);

  it.each([
    'Concordancia con el mercado laboral concentra el mayor desacuerdo: 37.7% responde en desacuerdo o totalmente en desacuerdo.',
    'Pertinencia de las labores tiene la media más alta y concordancia con el mercado laboral la más baja.',
    'Satisfacción global 151 2.77 0.62 73.5%',
    'Pertinencia de las labores 110 3.23 0.76 89.1%',
    'Lo más valorado: habilidades analíticas y resolución de problemas (53.9%).',
    'La mejora más pedida: actualización constante del plan de estudios (70.4%).',
    'Base de Datos es la más mencionada (94.7%).',
    'Aplic. Interactivas TV Digital es la menos útil para el 50.0%.',
    'Confianza y calidad del perfil 64.4',
    'Participación en mejora de la carrera 34.5',
    'Confianza en la Carrera es lo mejor valorado; perfil coherente, lo más bajo del perfil.',
    'La dimensión más débil es participación en mejora de la carrera; «Autoevaluación» tiene el menor índice (25.0).'
  ])('muestra: %s', (frase) => {
    expect(texto).toContain(frase);
  });
});

describe('Mercado laboral: textos generados con los datos', () => {
  const titulos = textoVisible(<TabLaborMarket titulados={titulados} empleadores={empleadores} />);
  const empresas = textoVisible(<TabLaborMarket titulados={titulados} empleadores={empleadores} vistaInicial="empleadores" />);

  it.each([
    'Tasa de ocupación 82.9% trabaja o emprende: 126 de 152',
    'El 17.1% no trabaja actualmente (26 titulados).',
    'El 76.9% consiguió empleo en 4 meses o menos; el 17.3% tardó más de 8 meses.',
    'Gana más de Bs. 7 000 el 52.8% en el sector privado y el 23.8% en el público.',
    'Desarrollo de Software concentra el 62.7% del empleo en organizaciones.',
    'La razón más citada: requisitos de habilidades específicas (28.0%).',
    'El 81.3% considera importante la formación recibida para su negocio.'
  ])('titulados muestra: %s', (frase) => {
    expect(titulos).toContain(frase);
  });

  it.each([
    'Sector privado 76.5% 39 de 51 organizaciones',
    'Contrató en los últimos 5 años 80.4% 41 de 51',
    'Exige licenciatura 72.5% 37 de 51',
    'IA es la única tecnología mencionada por más de la mitad de los empleadores.',
    '50 respuestas válidas, % de menciones',
    'Las más pedidas son adaptabilidad y aprendizaje continuo y trabajo en equipo.'
  ])('empleadores muestra: %s', (frase) => {
    expect(empresas).toContain(frase);
  });
});

describe('Portada y plan estratégico: cifras calculadas', () => {
  const portada = textoVisible(<TabOverview titulados={titulados} empleadores={empleadores} onNavigate={nada} />);
  const plan = textoVisible(<TabStrategicPlan titulados={titulados} empleadores={empleadores} onOpenReport={nada} />);

  it.each([
    'Tasa de ocupación 82.9% 126 de 152 trabaja o emprende',
    'Interés en un posgrado 82.8% 125 de 151',
    'Prefiere IA 43.7%',
    'Pagó su posgrado con recursos propios 91.1% 92 de 101',
    'Vinculación con empleadores 43.8',
    'El sector privado paga más Yates χ² = 4.385, p = 0.0363, V = 0.22',
    '82.8% interesados; IA e Ingeniería de Software suman 68.3% de las preferencias',
    '49.0% nunca fue consultado en la autoevaluación'
  ])('portada muestra: %s', (frase) => {
    expect(portada).toContain(frase);
  });

  it.each([
    '37.7% en desacuerdo con la concordancia; 70.4% pide actualizar el plan',
    'Aplic. Interactivas TV Digital 50.0%, Básicas (Física, Cálculo, Álgebra) 46.1% y Contabilidad Básica 43.4%',
    'Confianza de los empleadores en la Carrera: índice 64.4, 86.4% de acuerdo',
    'Ampliar las pasantías con empresas de software (solo 29.6% las valora hoy)',
    'hoy 8.9%; meta: 30%',
    'hoy 33.3%; meta: más de 70%',
    'hoy 62.3%; meta: más de 80%'
  ])('plan muestra: %s', (frase) => {
    expect(plan).toContain(frase);
  });
});

describe('Escenarios de decisión: resultados y textos generados', () => {
  const vista = (v: 'A' | 'B' | 'C' | 'generador') => textoVisible(<TabSimulationEngine titulados={titulados} vistaInicial={v} />);

  it('A: decisiones por área y contador de números usados', () => {
    const t = vista('A');
    expect(t).toContain(
      'IA, Ingeniería de Software y Redes de Datos y Seguridad alcanzan el mínimo de 15 inscritos en al menos el 80% de las réplicas; conviene ofrecer Base de Datos y Robótica como módulos.'
    );
    expect(t).toContain('Números usados 40 000 / 100 000');
    expect(t).toContain('base: 125 de 151');
    expect(t).toContain('base: 40 de 126');
  });

  it('B: incremento con convenios y prueba de Welch', () => {
    const t = vista('B');
    expect(t).toContain('Con 30.0% de becados, la matrícula pasa de 101.2 a 118.6 inscritos (+17.2%); la diferencia es significativa.');
    expect(t).toContain('Números usados 60 000 / 100 000');
    expect(t).toContain('base: 9 de 101');
  });

  it('C: inserción rápida', () => {
    const t = vista('C');
    expect(t).toContain('La inserción en 4 meses o menos sube de 76.9% a 88.5% (+11.7 puntos).');
    expect(t).toContain('Números usados 80 000 / 100 000');
  });

  it('generador: validación calculada', () => {
    const t = vista('generador');
    expect(t).toContain('El generador tiene período completo, pasa las pruebas de uniformidad e independencia, y la simulación reproduce las distribuciones de la base.');
    expect(t).toContain('Período del generador 100 000 100 000 Sí');
    expect(t).toContain('35 668');
  });

  it('el código fuente no usa Math.random()', () => {
    const fuentes = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    // Se ignoran los comentarios (la documentación menciona la regla)
    const sinComentarios = (codigo: string) => codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const conRandom = Object.entries(fuentes).filter(
      ([ruta, codigo]) => !ruta.includes('.test.') && /Math\.random\(/.test(sinComentarios(codigo))
    );
    expect(conRandom.map(([ruta]) => ruta)).toEqual([]);
  });
});

describe('Renderizado de la interfaz con la base real', () => {
  it.each(pantallas)('%s se renderiza sin errores', (_nombre, elemento) => {
    expect(renderToStaticMarkup(elemento).length).toBeGreaterThan(100);
  });
});

describe('Autenticación y administración', () => {
  it('el Header muestra el nombre, el rol y «Cerrar sesión»', () => {
    const texto = textoVisible(<Header activeTab="admin" onOpenReport={nada} tituladosCount={1} empleadoresCount={1} onToggleMobileMenu={nada} usuario={admin} onCerrarSesion={nada} />);
    expect(texto).toContain('Ana Quispe');
    expect(texto).toContain('Administrador');
    expect(texto).toContain('Cerrar sesión');
    expect(texto).toContain('Administración / Panel de control');
  });

  it('la sección Administración del Sidebar solo aparece para administradores', () => {
    const props = { activeTab: 'overview', setActiveTab: nada, onOpenReport: nada, tituladosCount: 1, empleadoresCount: 1, isOpenMobile: false, onCloseMobile: nada };
    expect(textoVisible(<Sidebar {...props} />)).not.toContain('Administración');
    const texto = textoVisible(<Sidebar {...props} esAdmin />);
    for (const etiqueta of ['Administración', 'Panel de control', 'Usuarios', 'Titulados', 'Empleadores', 'Dashboard']) expect(texto).toContain(etiqueta);
  });

  it('la pantalla de acceso tiene CI, contraseña con botón para mostrarla y enlace a «Crear cuenta»', () => {
    const html = renderToStaticMarkup(<PantallaAcceso onAutenticado={nada} />);
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain('type="password"');
    expect(html).toContain('aria-label="Mostrar contraseña"');
    expect(textoVisible(<PantallaAcceso onAutenticado={nada} />)).toContain('Crear cuenta');
  });

  it('el gráfico por día tiene su tabla con los totales', () => {
    const texto = textoVisible(<RegistrosPorDia dias={[{ fecha: '2026-10-28', titulados: 2, empleadores: 1 }]} />);
    expect(texto).toContain('Titulados Empleadores Total');
    expect(texto).toMatch(/mié 28\/10 2 1 3/);
  });
});
