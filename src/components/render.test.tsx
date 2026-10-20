/**
 * Prueba de humo: cada pestaña y formulario se renderiza sin errores con la base real.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { importarArchivo } from '../utils/importador';
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

const buffer = readFileSync(resolve(import.meta.dirname, '../../public/data/Base_Limpia_Titulados_Empleadores.xlsx'));
const base = await importarArchivo(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  'base.xlsx'
);
const titulados = base.titulados ?? [];
const empleadores = base.empleadores ?? [];
const nada = () => undefined;

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
  ['Encuesta titulados', <FormTituladosSurvey onAddTitulado={nada} onNavigateToAnalytics={nada} idsExistentes={titulados.map((t) => t.id)} />],
  ['Encuesta empleadores', <FormEmpleadoresSurvey onAddEmpleador={nada} onNavigateToAnalytics={nada} idsExistentes={empleadores.map((e) => e.id)} />],
  ['Informe imprimible', <OfficialReportModal isOpen onClose={nada} titulados={titulados} empleadores={empleadores} />]
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
    '6 años',
    'Q1 2 · Q3 14',
    'La media supera a la mediana porque 13 titulados (9.0%) tienen más de 20 años de trayectoria.',
    'Los junior promedian 1.93 años y los consolidados 13.99 años.',
    'El grupo más numeroso es el de 35 años o más (43.2%).',
    'El 77.7% son hombres y el 22.3% mujeres.',
    'El 50.3% acumula menos de un año sin empleo.',
    'Mediana del tiempo cesante sobre 143 titulados, incluidos los ceros 0.75 años',
    'Desempleo sobre la trayectoria años sin empleo / años de vida profesional 9.0%',
    'Nunca estuvo desempleado 60 de 143 42.0%',
    'Interés en un posgrado 83.0% 122 de 147',
    'Las dos áreas principales (IA e Ingeniería de Software) suman 67.5% de las preferencias, cerca del umbral de alerta de 70%.',
    'Base de Datos (8.1%) y Robótica (4.1%) tienen baja demanda como programas independientes.',
    'Universidades internacionales es la segunda opción (25.2%); la UMSS (Posgrado FCyT y EUPG) reúne el 41.5%.',
    'Diplomado y maestría suman 94.9% de los programas cursados.',
    'El 91.8% lo pagó con recursos propios.'
  ])('muestra: %s', (frase) => {
    expect(texto).toContain(frase);
  });

  it('no repite en la línea del gráfico el porcentaje de la nota de umbral', () => {
    expect(texto.split('67.5%')).toHaveLength(2);
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
    '2.206 (0.1375)',
    '9.726 (0.1367)',
    '4.013 (0.0452)',
    'Pagaron con recursos propios 63 de 66 en Diplomado (95.5%) y 27 de 32 en Especialidad, Maestría o Doctorado (84.4%).',
    'Prueba exacta de Fisher Resultado oficial p = 0.1089',
    '1 de 4 celdas tiene frecuencia esperada menor que 5 (mínima 2.61): por eso el resultado oficial es la prueba exacta de Fisher.',
    'No se rechaza H₀ (p = 0.1089 ≥ 0.05): no hay evidencia de asociación entre nivel del programa y financiamiento.',
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
    'Concordancia con el mercado laboral concentra el mayor desacuerdo: 38.1% responde en desacuerdo o totalmente en desacuerdo.',
    'Pertinencia de las labores tiene la media más alta y concordancia con el mercado laboral la más baja.',
    'Satisfacción global 147 2.78 0.63 74.1%',
    'Pertinencia de las labores 108 3.25 0.75 90.7%',
    'Lo más valorado: habilidades analíticas y resolución de problemas (55.4%).',
    'La mejora más pedida: actualización constante del plan de estudios (71.6%).',
    'Base de Datos es la más mencionada (94.6%).',
    'Aplic. Interactivas TV Digital es la menos útil para el 48.6%.',
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
    'Tasa de ocupación 83.1% trabaja o emprende: 123 de 148',
    'El 16.9% no trabaja actualmente (25 titulados).',
    'El 76.2% consiguió empleo en 4 meses o menos; el 17.8% tardó más de 8 meses.',
    'Gana más de Bs. 7 000 el 53.5% en el sector privado y el 25.0% en el público.',
    'Desarrollo de Software concentra el 62.0% del empleo en organizaciones.',
    'La razón más citada: requisitos de habilidades específicas (28.0%).',
    'El 80.0% considera importante la formación recibida para su negocio.'
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
    'Tasa de ocupación 83.1% 123 de 148 trabaja o emprende',
    'Interés en un posgrado 83.0% 122 de 147',
    'Prefiere IA 43.9%',
    'Pagó su posgrado con recursos propios 91.8% 90 de 98',
    'Vinculación con empleadores 43.8',
    'El sector privado paga más Yates χ² = 4.013, p = 0.0452, V = 0.21',
    '83.0% interesados; IA e Ingeniería de Software suman 67.5% de las preferencias',
    '49.0% nunca fue consultado en la autoevaluación'
  ])('portada muestra: %s', (frase) => {
    expect(portada).toContain(frase);
  });

  it.each([
    '38.1% en desacuerdo con la concordancia; 71.6% pide actualizar el plan',
    'Aplic. Interactivas TV Digital 48.6%, Básicas (Física, Cálculo, Álgebra) 46.6% y Contabilidad Básica 42.6%',
    'Confianza de los empleadores en la Carrera: índice 64.4, 86.4% de acuerdo',
    'Ampliar las pasantías con empresas de software (solo 30.4% las valora hoy)',
    'hoy 8.2%; meta: 30%',
    'hoy 33.3%; meta: más de 70%',
    'hoy 61.9%; meta: más de 80%'
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
    expect(t).toContain('base: 122 de 147');
    expect(t).toContain('base: 38 de 123');
  });

  it('B: incremento con convenios y prueba de Welch', () => {
    const t = vista('B');
    expect(t).toContain('Con 30.0% de becados, la matrícula pasa de 98.5 a 116.2 inscritos (+18.0%); la diferencia es significativa.');
    expect(t).toContain('Números usados 60 000 / 100 000');
    expect(t).toContain('base: 8 de 98');
  });

  it('C: inserción rápida', () => {
    const t = vista('C');
    expect(t).toContain('La inserción en 4 meses o menos sube de 76.2% a 88.2% (+12.0 puntos).');
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
