import React, { useMemo } from 'react';
import { Printer, X } from 'lucide-react';
import { Empleador, Titulado } from '../types';
import { INFO_INSTITUCIONAL } from '../data/strategicPlan';
import { UMBRAL_JUNIOR_ANIOS } from '../data/catalogos';
import { PRUEBAS_INDEPENDENCIA } from '../utils/analisis';
import { histograma, NOMBRE_METODO, pruebaIndependencia } from '../utils/estadistica';
import { calcularResumen, generarPlanAccion } from '../utils/hallazgos';
import { parametrosDesdeBase, simularEscenarioA, simularEscenarioB, simularEscenarioC, SUPUESTOS_INFORME } from '../utils/simulacion';
import { num, numOrden, pct, textoP, unirDos } from '../utils/formato';
import { COLOR, COLOR_CATEGORIA } from '../ui/tema';
import { BarrasHorizontales } from './graficos/BarrasHorizontales';
import { BarrasAgrupadas } from './graficos/BarrasAgrupadas';
import { Histograma } from './graficos/Histograma';
import { Radar } from './graficos/Radar';

interface OfficialReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  titulados: Titulado[];
  empleadores: Empleador[];
}

/** Página A4 del informe: al imprimir, cada una empieza en una hoja nueva. */
function Pagina({ numero, titulo, children }: { numero: number; titulo?: string; children: React.ReactNode }) {
  return (
    <section className="pagina-informe bg-white mx-auto w-full max-w-[170mm] py-10 print:py-0 border-b border-slate-200 print:border-0">
      {titulo && <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-300 pb-2 mb-5">{titulo}</h2>}
      <div className="space-y-5">{children}</div>
      <p className="mt-8 text-[10px] text-slate-400 text-right print:hidden">Página {numero}</p>
    </section>
  );
}

function Figura({ titulo, fuente, children }: { titulo: string; fuente: string; children: React.ReactNode }) {
  return (
    <figure className="sin-cortes">
      <figcaption className="text-sm font-semibold text-slate-900 mb-1">{titulo}</figcaption>
      {children}
      <p className="mt-1 text-[10px] text-slate-500">Fuente: {fuente}</p>
    </figure>
  );
}

function Tabla({ encabezados, filas, alinearDerecha = [] }: { encabezados: string[]; filas: string[][]; alinearDerecha?: number[] }) {
  return (
    <table className="w-full text-xs tabular-nums sin-cortes">
      <thead>
        <tr className="border-b border-slate-400 text-slate-700">
          {encabezados.map((e, i) => (
            <th key={e} className={`py-1.5 px-1.5 first:pl-0 font-semibold ${alinearDerecha.includes(i) ? 'text-right' : 'text-left'}`}>
              {e}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f, k) => (
          <tr key={k} className="border-b border-slate-200 align-top">
            {f.map((c, i) => (
              <td key={i} className={`py-1.5 px-1.5 first:pl-0 ${alinearDerecha.includes(i) ? 'text-right' : 'text-left'}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const OfficialReportModal: React.FC<OfficialReportModalProps> = ({ isOpen, onClose, titulados, empleadores }) => {
  const r = useMemo(() => calcularResumen(titulados, empleadores), [titulados, empleadores]);
  const sim = useMemo(() => {
    const base = parametrosDesdeBase(titulados);
    return {
      a: simularEscenarioA(base, SUPUESTOS_INFORME.A),
      b: simularEscenarioB(base, SUPUESTOS_INFORME.B),
      c: simularEscenarioC(base, SUPUESTOS_INFORME.C)
    };
  }, [titulados]);
  const pruebas = useMemo(
    () => PRUEBAS_INDEPENDENCIA.map((def) => ({ def, prueba: pruebaIndependencia(def.construir(titulados)) })),
    [titulados]
  );
  if (!isOpen) return null;

  const g = r.vida.general;
  const anios = titulados.map((t) => t.anios_vida_profesional).filter((v): v is number => v !== undefined);
  const [area1, area2] = r.ordenar(r.posgrado.areas.filas);
  const propios = r.posgrado.financiamientos.filas.find((f) => f.categoria === 'Recursos propios');
  const ia = r.emp.tecnologias.temas.find((t) => t.categoria === 'IA');
  const iaSim = sim.a.areas.find((x) => x.area === area1?.categoria);
  const actualizar = r.aspectos.mejorar.filas.find((f) => f.categoria === 'Actualización constante del plan');
  const participacion = r.dimensiones[3];
  const privado = r.mercado.remuneracionPorSector.find((x) => x.sector === 'Privado')?.tabla;
  const publico = r.mercado.remuneracionPorSector.find((x) => x.sector === 'Público')?.tabla;

  const kpis = [
    { valor: pct(r.mercado.ocupacion.porcentaje), etiqueta: 'Tasa de ocupación', contexto: `${r.mercado.ocupacion.n} de ${r.mercado.ocupacion.total}` },
    { valor: pct(r.mercado.insercionRapida.porcentaje), etiqueta: 'Empleo en 4 meses o menos', contexto: `de ${r.mercado.insercionRapida.total} que trabajan` },
    { valor: `${numOrden(g?.mediana)} años`, etiqueta: 'Mediana de vida profesional', contexto: `media ${num(g?.media, 2)}` },
    { valor: pct(r.posgrado.interesados.porcentaje), etiqueta: 'Interés en un posgrado', contexto: `${r.posgrado.interesados.n} de ${r.posgrado.interesados.total}` },
    { valor: pct(propios?.porcentaje), etiqueta: 'Posgrado con recursos propios', contexto: `${propios?.n ?? 0} de ${r.posgrado.financiamientos.total}` },
    { valor: num(participacion?.indice, 1), etiqueta: 'Participación de empleadores', contexto: 'índice de 0 a 100' }
  ];

  const conclusiones = [
    `El ${pct(r.mercado.ocupacion.porcentaje)} de los titulados trabaja o emprende y el ${pct(r.mercado.insercionRapida.porcentaje)} consiguió empleo en 4 meses o menos.`,
    `El ${pct(r.posgrado.interesados.porcentaje)} quiere un posgrado; ${unirDos(area1?.categoria ?? '', area2?.categoria ?? '')} reúnen el ${pct(r.posgrado.concentracionAreas.porcentaje)} de las preferencias y un programa en ${area1?.categoria} alcanzaría el mínimo de ${SUPUESTOS_INFORME.A.umbral} inscritos en el ${pct(iaSim?.probabilidadUmbral)} de las réplicas.`,
    `El ${pct(propios?.porcentaje)} pagó su posgrado con recursos propios; con ${pct(SUPUESTOS_INFORME.B.metaBecas * 100)} de becados la matrícula simulada sube ${pct(sim.b.incremento)}.`,
    `El ${pct(r.desacuerdoConcordancia)} percibe desfase entre su formación y el mercado, el ${pct(actualizar?.porcentaje)} pide actualizar el plan y el ${pct(ia?.porcentaje)} de los empleadores demanda IA.`,
    `La vinculación con los empleadores es la brecha principal: el ${pct(r.nuncaConsultados)} nunca fue consultado y el índice de participación es ${num(participacion?.indice, 1)} sobre 100.`
  ];

  return (
    <div className="informe-capa fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 print:static print:overflow-visible print:bg-white">
      <div className="max-w-[210mm] mx-auto my-6 bg-white shadow-sm px-[20mm] print:shadow-none print:my-0 print:px-0">
        <div className="sticky top-0 z-10 -mx-[20mm] px-[20mm] py-3 bg-white border-b border-slate-200 flex items-center justify-between print:hidden">
          <span className="text-sm text-slate-700">Informe ejecutivo · 5 páginas A4</span>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-institucional rounded">
              <Printer className="w-4 h-4" /> Imprimir o guardar PDF
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-800" aria-label="Cerrar informe">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1. Portada */}
        <Pagina numero={1}>
          <div className="pt-16 space-y-6">
            <p className="text-sm text-slate-600">
              {INFO_INSTITUCIONAL.universidad}
              <br />
              {INFO_INSTITUCIONAL.facultad} · {INFO_INSTITUCIONAL.carrera}
            </p>
            <h1 className="text-2xl font-semibold text-slate-900 leading-snug">
              Análisis de mercado del perfil, la formación y la empleabilidad de los titulados de Ingeniería de Sistemas
            </h1>
            <p className="text-base text-slate-700">Informe ejecutivo para la autoevaluación ARCU-SUR</p>
            <dl className="pt-10 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm text-slate-700">
              <dt className="text-slate-500">Materia</dt>
              <dd>{INFO_INSTITUCIONAL.materia}</dd>
              <dt className="text-slate-500">Equipo</dt>
              <dd>
                {INFO_INSTITUCIONAL.grupo}: {INFO_INSTITUCIONAL.integrantes.join(', ')}
              </dd>
              <dt className="text-slate-500">Docente</dt>
              <dd>{INFO_INSTITUCIONAL.docente}</dd>
              <dt className="text-slate-500">Datos</dt>
              <dd>
                Encuesta a {titulados.length} titulados y {empleadores.length} empleadores
              </dd>
              <dt className="text-slate-500">Lugar y fecha</dt>
              <dd>
                {INFO_INSTITUCIONAL.ubicacion}, {INFO_INSTITUCIONAL.fecha}
              </dd>
            </dl>
          </div>
        </Pagina>

        {/* 2. Indicadores, perfil y posgrado */}
        <Pagina numero={2} titulo="Indicadores clave, perfil y posgrado">
          <div className="grid grid-cols-3 gap-3 sin-cortes">
            {kpis.map((k) => (
              <div key={k.etiqueta} className="border border-slate-300 rounded px-3 py-2">
                <div className="text-[11px] text-slate-600">{k.etiqueta}</div>
                <div className="text-xl font-semibold text-slate-900 tabular-nums">{k.valor}</div>
                <div className="text-[10px] text-slate-500">{k.contexto}</div>
              </div>
            ))}
          </div>
          <Figura titulo="Años de vida profesional" fuente={`encuesta a titulados, ${anios.length} con dato`}>
            <Histograma
              intervalos={histograma(anios, 1)}
              etiquetaX="Años de vida profesional"
              alto={190}
              colorDe={(i) => (i.desde < UMBRAL_JUNIOR_ANIOS ? COLOR_CATEGORIA['Junior (< 5 años)'] : COLOR_CATEGORIA['Consolidado (≥ 5 años)'])}
              referencias={g ? [{ valor: g.mediana, texto: 'Mediana', color: COLOR.naranja }] : []}
            />
          </Figura>
          <div className="grid grid-cols-2 gap-4">
            <Figura titulo="Área de posgrado de interés" fuente={`interesados, n = ${r.posgrado.areas.total}`}>
              <BarrasHorizontales
                datos={r.posgrado.areas.filas.map((f) => ({ categoria: f.categoria, n: f.n, porcentaje: f.porcentaje }))}
                resaltar={r.posgrado.concentracionAreas.categorias}
                anchoEtiquetas={120}
              />
            </Figura>
            <Figura titulo="Financiamiento del posgrado cursado" fuente={`n = ${r.posgrado.financiamientos.total}`}>
              <BarrasHorizontales
                datos={r.posgrado.financiamientos.filas.map((f) => ({ categoria: f.categoria, n: f.n, porcentaje: f.porcentaje }))}
                anchoEtiquetas={110}
              />
            </Figura>
          </div>
        </Pagina>

        {/* 3. Mercado y radar */}
        <Pagina numero={3} titulo="Mercado laboral y demanda de los empleadores">
          <Figura
            titulo="Remuneración mensual según sector (% dentro de cada sector)"
            fuente={`titulados que informaron su remuneración: privado n = ${privado?.total ?? 0}, público n = ${publico?.total ?? 0}`}
          >
            <BarrasAgrupadas
              alto={220}
              series={[
                { clave: 'Privado', nombre: 'Sector privado', color: COLOR_CATEGORIA.Privado },
                { clave: 'Público', nombre: 'Sector público', color: COLOR_CATEGORIA['Público'] }
              ]}
              datos={(privado?.filas ?? []).map((f, i) => ({
                categoria: f.categoria.replace('Entre Bs. ', '').replace('Menor a Bs. ', '< ').replace('Más de Bs. ', '> ').replace(' - Bs. ', '–').replace(/\./g, ' '),
                Privado: f.porcentaje,
                Público: publico?.filas[i]?.porcentaje ?? 0
              }))}
            />
          </Figura>
          <Figura titulo="Tecnologías que demandan los empleadores (% de menciones)" fuente={`encuesta a empleadores, ${r.emp.tecnologias.validas} respuestas válidas`}>
            <Radar alto={300} sufijo="%" puntos={r.emp.tecnologias.temas.map((t) => ({ eje: t.categoria, valor: t.porcentaje }))} />
          </Figura>
        </Pagina>

        {/* 4. Pruebas y simulación */}
        <Pagina numero={4} titulo="Pruebas de independencia y escenarios simulados">
          <Figura titulo="Pruebas de independencia (α = 0.05)" fuente="encuesta a titulados; Fisher si alguna frecuencia esperada es menor que 5, si no Yates (2×2)">
            <Tabla
              encabezados={['Relación', 'n', 'Método oficial', 'Estadístico', 'p', 'Decisión']}
              alinearDerecha={[1, 3, 4]}
              filas={pruebas.map(({ def, prueba: p }) => [
                def.relacion,
                String(p?.tabla.total ?? 0),
                p ? NOMBRE_METODO[p.metodoOficial] : '—',
                p?.estadisticoOficial !== null && p?.estadisticoOficial !== undefined ? `χ² = ${num(p.estadisticoOficial, 3)}` : '—',
                textoP(p?.pValorOficial).replace('p = ', '').replace('p ', ''),
                p?.rechazaH0 ? 'Se rechaza H₀' : 'No se rechaza H₀'
              ])}
            />
          </Figura>
          <Figura
            titulo={`Escenario A: inscritos esperados por área (${sim.a.replicas} réplicas, IC 95%)`}
            fuente={`generador congruencial mixto, semilla ${SUPUESTOS_INFORME.A.semilla}; conversión ${pct(SUPUESTOS_INFORME.A.conversion * 100)}`}
          >
            <Tabla
              encabezados={['Área', 'Media', 'IC 95%', `Réplicas ≥ ${SUPUESTOS_INFORME.A.umbral}`, 'Decisión']}
              alinearDerecha={[1, 2, 3]}
              filas={sim.a.areas.map((x) => [
                x.area,
                num(x.ic?.media, 1),
                `[${num(x.ic?.inferior, 1)}, ${num(x.ic?.superior, 1)}]`,
                pct(x.probabilidadUmbral),
                x.decision
              ])}
            />
          </Figura>
          <Figura titulo="Escenarios B y C" fuente="IC 95% con t de Student; diferencia con prueba t de Welch">
            <Tabla
              encabezados={['Escenario', 'Actual', 'Simulado', 'Diferencia', 'p']}
              alinearDerecha={[1, 2, 3, 4]}
              filas={[
                [
                  `B. Becas (${pct(SUPUESTOS_INFORME.B.metaBecas * 100)} de becados), inscritos`,
                  num(sim.b.actual?.media, 1),
                  num(sim.b.convenio?.media, 1),
                  `+${num(sim.b.diferencia?.diferencia, 1)}`,
                  textoP(sim.b.diferencia?.pValor).replace('p = ', '').replace('p ', '')
                ],
                [
                  'C. Pasantías, empleo en 4 meses o menos',
                  pct(sim.c.rapidaReal?.media),
                  pct(sim.c.rapidaSimulada?.media),
                  `+${num(sim.c.diferencia?.diferencia, 1)} puntos`,
                  textoP(sim.c.diferencia?.pValor).replace('p = ', '').replace('p ', '')
                ]
              ]}
            />
          </Figura>
        </Pagina>

        {/* 5. Conclusiones y plan */}
        <Pagina numero={5} titulo="Conclusiones y plan de acción">
          <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-800 sin-cortes">
            {conclusiones.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <Figura titulo="Plan de acción" fuente="propuesta del informe; la línea base se calcula con la base activa">
            <Tabla
              encabezados={['Línea', 'Acción', 'Indicador', 'Plazo']}
              filas={generarPlanAccion(r).map((a) => [a.linea, a.accion, a.indicador, a.plazo])}
            />
          </Figura>
        </Pagina>
      </div>
    </div>
  );
};
