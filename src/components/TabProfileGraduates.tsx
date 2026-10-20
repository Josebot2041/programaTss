import React, { useMemo, useState } from 'react';
import { Titulado } from '../types';
import { UMBRAL_JUNIOR_ANIOS } from '../data/catalogos';
import {
  analizarDemandaPosgrado,
  analizarDesempleo,
  analizarPerfil,
  analizarVidaProfesional,
  UMBRAL_CONCENTRACION
} from '../utils/analisis';
import { histograma, type Descriptivos, type TablaFrecuencias } from '../utils/estadistica';
import { num, numOrden, pct, unirDos } from '../utils/formato';
import { COLOR, COLOR_CATEGORIA } from '../ui/tema';
import { EncabezadoPagina, FilaKpi, Kpi, Nota, Panel, Seccion, Selector } from './ui/Estructura';
import { BarrasHorizontales, type DatoBarra } from './graficos/BarrasHorizontales';
import { Histograma } from './graficos/Histograma';

interface TabProfileGraduatesProps {
  titulados: Titulado[];
}

type Filtro = 'todos' | 'junior' | 'consolidado';

/** Nombres completos de las instituciones (las áreas se muestran como en la base). */
const ETIQUETAS: Record<string, string> = {
  'Univ. públicas nacionales': 'Universidades públicas nacionales',
  'Univ. privadas nacionales': 'Universidades privadas nacionales',
  'Univ. internacionales': 'Universidades internacionales',
  Otro: 'Otra institución'
};
const etiqueta = (categoria: string) => ETIQUETAS[categoria] ?? categoria;

/** Filas para un gráfico de barras, con nombres para mostrar. */
const barras = (tabla: TablaFrecuencias, omitirCeros = true): DatoBarra[] =>
  tabla.filas
    .filter((f) => !omitirCeros || f.n > 0)
    .map((f) => ({ categoria: etiqueta(f.categoria), n: f.n, porcentaje: f.porcentaje }));

/** Las dos categorías más frecuentes de una tabla. */
const principales = (tabla: TablaFrecuencias) => [...tabla.filas].sort((a, b) => b.n - a.n);

export const TabProfileGraduates: React.FC<TabProfileGraduatesProps> = ({ titulados }) => {
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const filtrados = useMemo(() => {
    if (filtro === 'junior') return titulados.filter((t) => t.segmento === 'Junior (< 5 años)');
    if (filtro === 'consolidado') return titulados.filter((t) => t.segmento === 'Consolidado (≥ 5 años)');
    return titulados;
  }, [titulados, filtro]);

  // Segmentación sobre toda la base (define el filtro) y análisis sobre el subconjunto filtrado
  const segmentos = useMemo(() => analizarVidaProfesional(titulados), [titulados]);
  const vida = useMemo(() => analizarVidaProfesional(filtrados), [filtrados]);
  const desempleo = useMemo(() => analizarDesempleo(filtrados), [filtrados]);
  const perfil = useMemo(() => analizarPerfil(filtrados), [filtrados]);
  const posgrado = useMemo(() => analizarDemandaPosgrado(filtrados), [filtrados]);

  const anios = filtrados.map((t) => t.anios_vida_profesional).filter((v): v is number => v !== undefined);
  const intervalos = histograma(anios, 1);
  const g = vida.general;

  const nJunior = segmentos.junior?.n ?? 0;
  const nConsolidado = segmentos.consolidado?.n ?? 0;
  const nConDato = nJunior + nConsolidado;

  const fuenteTitulados = `encuesta a titulados, n = ${filtrados.length}`;

  // --- Interpretaciones generadas con los valores calculados
  const masDe20 = anios.filter((a) => a > 20).length;
  const textoHistograma = !g
    ? 'Sin datos para el segmento seleccionado.'
    : g.media > g.mediana && masDe20 > 0
      ? `La media supera a la mediana porque ${masDe20} titulados (${pct((100 * masDe20) / anios.length)}) tienen más de 20 años de trayectoria.`
      : `El rango va de ${numOrden(g.min)} a ${numOrden(g.max)} años de vida profesional.`;

  const textoSegmentos =
    segmentos.junior && segmentos.consolidado
      ? `Los junior promedian ${num(segmentos.junior.media, 2)} años y los consolidados ${num(segmentos.consolidado.media, 2)} años.`
      : undefined;

  const edadMayor = principales(perfil.edades)[0];
  const hombres = perfil.generos.filas.find((f) => f.categoria === 'Hombre');
  const mujeres = perfil.generos.filas.find((f) => f.categoria === 'Mujer');

  const [area1, area2] = principales(posgrado.areas);
  const areasMenores = principales(posgrado.areas).filter((f) => f.n > 0).slice(-2);
  const eupg = posgrado.instituciones.filas.find((f) => f.categoria === 'EUPG');
  const [inst1, inst2] = principales(posgrado.instituciones);
  const [nivel1, nivel2] = principales(posgrado.niveles);
  const [lugar1] = principales(posgrado.lugares);
  const propios = posgrado.financiamientos.filas.find((f) => f.categoria === 'Recursos propios');
  const fcyt = posgrado.instituciones.filas.find((f) => f.categoria === 'Posgrado FCyT');
  const top2 = posgrado.concentracionAreas.porcentaje;

  const textoAlerta =
    area1 && area2
      ? {
          alerta: `Las dos áreas principales (${unirDos(area1.categoria, area2.categoria)}) suman ${pct(top2)} de las preferencias y superan el umbral de ${UMBRAL_CONCENTRACION}%: la demanda está concentrada.`,
          cerca: `Las dos áreas principales (${unirDos(area1.categoria, area2.categoria)}) suman ${pct(top2)} de las preferencias, cerca del umbral de alerta de ${UMBRAL_CONCENTRACION}%.`,
          normal: `Las dos áreas principales (${unirDos(area1.categoria, area2.categoria)}) suman ${pct(top2)} de las preferencias, por debajo del umbral de ${UMBRAL_CONCENTRACION}%.`
        }[posgrado.alertaAreas]
      : undefined;

  return (
    <div className="space-y-10">
      <EncabezadoPagina
        titulo="Perfil de los titulados"
        descripcion="Trayectoria profesional y demanda de posgrado. El filtro de segmento se aplica a toda la página."
        acciones={
          <Selector<Filtro>
            etiqueta="Segmento"
            valor={filtro}
            onCambiar={setFiltro}
            opciones={[
              { valor: 'todos', texto: `Todos (${titulados.length})` },
              { valor: 'junior', texto: `Junior (${nJunior})` },
              { valor: 'consolidado', texto: `Consolidado (${nConsolidado})` }
            ]}
          />
        }
      />

      {/* HU1: vida profesional */}
      <Seccion
        titulo="Vida profesional"
        descripcion={`Años de ejercicio profesional. Junior: menos de ${UMBRAL_JUNIOR_ANIOS} años; consolidado: ${UMBRAL_JUNIOR_ANIOS} o más.`}
      >
        <FilaKpi>
          <Kpi valor={`${num(g?.media, 2)} años`} etiqueta="Media" contexto={`Desviación estándar: ${num(g?.desviacion, 2)}`} />
          <Kpi valor={`${numOrden(g?.mediana)} años`} etiqueta="Mediana" contexto={`Q1 ${numOrden(g?.q1)} · Q3 ${numOrden(g?.q3)}`} />
          <Kpi valor={String(nJunior)} etiqueta="Junior" contexto={`${pct((100 * nJunior) / (nConDato || 1))} de ${nConDato} con dato`} />
          <Kpi
            valor={String(nConsolidado)}
            etiqueta="Consolidado"
            contexto={`${pct((100 * nConsolidado) / (nConDato || 1))} de ${nConDato} con dato`}
          />
        </FilaKpi>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Panel
            className="lg:col-span-3"
            titulo="Distribución de los años de vida profesional"
            interpretacion={textoHistograma}
            fuente={`${fuenteTitulados}; ${anios.length} con dato`}
          >
            <Histograma
              intervalos={intervalos}
              etiquetaX="Años de vida profesional"
              colorDe={(i) =>
                i.desde < UMBRAL_JUNIOR_ANIOS ? COLOR_CATEGORIA['Junior (< 5 años)'] : COLOR_CATEGORIA['Consolidado (≥ 5 años)']
              }
              referencias={
                g
                  ? [
                      { valor: g.mediana, texto: `Mediana ${numOrden(g.mediana)}`, color: COLOR.naranja },
                      { valor: g.media, texto: `Media ${num(g.media, 2)}`, color: COLOR.grisOscuro }
                    ]
                  : []
              }
            />
            <Leyenda
              elementos={[
                { color: COLOR_CATEGORIA['Junior (< 5 años)'], texto: 'Junior' },
                { color: COLOR_CATEGORIA['Consolidado (≥ 5 años)'], texto: 'Consolidado' },
                ...(g
                  ? [
                      { color: COLOR.naranja, texto: `Mediana (${numOrden(g.mediana)})`, linea: true },
                      { color: COLOR.grisOscuro, texto: `Media (${num(g.media, 2)})`, linea: true }
                    ]
                  : [])
              ]}
            />
          </Panel>

          <Panel
            className="lg:col-span-2"
            titulo="Estadísticos por segmento"
            interpretacion={textoSegmentos}
            fuente="encuesta a titulados (toda la base)"
          >
            <TablaDescriptivos
              filas={[
                ['Todos', segmentos.general],
                ['Junior', segmentos.junior],
                ['Consolidado', segmentos.consolidado]
              ]}
            />
            {segmentos.sinDato > 0 && (
              <p className="mt-3 text-xs text-slate-500">{segmentos.sinDato} titulados no informaron sus años de vida profesional.</p>
            )}
          </Panel>
        </div>
      </Seccion>

      {/* Perfil general */}
      <Seccion titulo="Perfil general">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel
            titulo="Edad"
            interpretacion={edadMayor ? `El grupo más numeroso es el de ${edadMayor.categoria} (${pct(edadMayor.porcentaje)}).` : undefined}
            fuente={fuenteTitulados}
          >
            <BarrasHorizontales datos={barras(perfil.edades, false)} anchoEtiquetas={110} />
          </Panel>

          <Panel
            titulo="Género"
            interpretacion={hombres && mujeres ? `El ${pct(hombres.porcentaje)} son hombres y el ${pct(mujeres.porcentaje)} mujeres.` : undefined}
            fuente={fuenteTitulados}
          >
            <BarrasHorizontales datos={barras(perfil.generos, false)} anchoEtiquetas={70} />
          </Panel>

          <Panel
            titulo="Desempleo acumulado"
            interpretacion={`El ${pct(desempleo.menosDeUnAnio.porcentaje)} acumula menos de un año sin empleo.`}
            fuente={`encuesta a titulados, n = ${desempleo.nuncaDesempleado.total} con dato`}
          >
            <dl className="space-y-3">
              {[
                {
                  termino: 'Mediana del tiempo cesante',
                  valor: `${numOrden(desempleo.tiempoCesante?.mediana)} años`,
                  detalle: `sobre ${desempleo.tiempoCesante?.n ?? 0} titulados, incluidos los ceros`
                },
                {
                  termino: 'Desempleo sobre la trayectoria',
                  valor: pct(desempleo.tasaSobreTrayectoria),
                  detalle: 'años sin empleo / años de vida profesional'
                },
                {
                  termino: 'Nunca estuvo desempleado',
                  valor: pct(desempleo.nuncaDesempleado.porcentaje),
                  detalle: `${desempleo.nuncaDesempleado.n} de ${desempleo.nuncaDesempleado.total}`
                }
              ].map((fila) => (
                <div key={fila.termino} className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
                  <div>
                    <dt className="text-sm text-slate-700">{fila.termino}</dt>
                    <dd className="text-xs text-slate-500">{fila.detalle}</dd>
                  </div>
                  <dd className="text-lg font-semibold text-slate-900 tabular-nums">{fila.valor}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </Seccion>

      {/* HU2: demanda de posgrado */}
      <Seccion titulo="Demanda de posgrado" descripcion="Interés en un nuevo posgrado y formación de posgrado ya realizada.">
        <FilaKpi>
          <Kpi
            valor={pct(posgrado.interesados.porcentaje)}
            etiqueta="Interés en un posgrado"
            contexto={`${posgrado.interesados.n} de ${posgrado.interesados.total}`}
          />
          <Kpi
            valor={pct(posgrado.cursaron.porcentaje)}
            etiqueta="Ya cursó un posgrado"
            contexto={`${posgrado.cursaron.n} de ${posgrado.cursaron.total}`}
          />
          <Kpi valor={pct(posgrado.conBeca.porcentaje)} etiqueta="Estudió con beca" contexto={`${posgrado.conBeca.n} de ${posgrado.conBeca.total}`} />
          <Kpi
            valor={pct(fcyt?.porcentaje)}
            etiqueta="Prefiere el Posgrado FCyT"
            contexto={`${fcyt?.n ?? 0} de ${posgrado.instituciones.total} interesados`}
          />
        </FilaKpi>

        {textoAlerta && <Nota tono={posgrado.alertaAreas === 'normal' ? 'neutro' : 'resalte'}>{textoAlerta}</Nota>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel
            titulo="Área de interés"
            interpretacion={
              areasMenores.length === 2
                ? `${unirDos(`${areasMenores[0].categoria} (${pct(areasMenores[0].porcentaje)})`, `${areasMenores[1].categoria} (${pct(areasMenores[1].porcentaje)})`)} tienen baja demanda como programas independientes.`
                : undefined
            }
            fuente={`titulados interesados en un posgrado, n = ${posgrado.areas.total}`}
          >
            <BarrasHorizontales
              datos={barras(posgrado.areas, false)}
              resaltar={posgrado.concentracionAreas.categorias}
              anchoEtiquetas={200}
            />
          </Panel>

          <Panel
            titulo="Institución preferida"
            interpretacion={
              inst1 && inst2
                ? `${etiqueta(inst2.categoria)} es la segunda opción (${pct(inst2.porcentaje)}); la UMSS (Posgrado FCyT y EUPG) reúne el ${pct((fcyt?.porcentaje ?? 0) + (eupg?.porcentaje ?? 0))}.`
                : undefined
            }
            fuente={`titulados interesados en un posgrado, n = ${posgrado.instituciones.total}`}
          >
            <BarrasHorizontales datos={barras(posgrado.instituciones)} anchoEtiquetas={230} />
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel
            titulo="Nivel del posgrado cursado"
            interpretacion={
              nivel1 && nivel2
                ? `${unirDos(nivel1.categoria, nivel2.categoria.toLowerCase())} suman ${pct(posgrado.concentracionNiveles.porcentaje)} de los programas cursados.`
                : undefined
            }
            fuente={`titulados que cursaron un posgrado, n = ${posgrado.niveles.total}`}
          >
            <BarrasHorizontales datos={barras(posgrado.niveles)} anchoEtiquetas={100} />
          </Panel>

          <Panel
            titulo="Institución donde lo cursó"
            interpretacion={
              lugar1 ? `${etiqueta(lugar1.categoria)} es la institución más frecuente (${pct(lugar1.porcentaje)}).` : undefined
            }
            fuente={`titulados que cursaron un posgrado, n = ${posgrado.lugares.total}`}
          >
            <BarrasHorizontales datos={barras(posgrado.lugares)} anchoEtiquetas={170} />
          </Panel>

          <Panel
            titulo="Financiamiento del posgrado"
            interpretacion={
              propios
                ? `El ${pct(propios.porcentaje)} lo pagó con recursos propios.`
                : undefined
            }
            fuente={`titulados que cursaron un posgrado, n = ${posgrado.financiamientos.total}`}
          >
            <BarrasHorizontales datos={barras(posgrado.financiamientos)} anchoEtiquetas={130} />
          </Panel>
        </div>
      </Seccion>
    </div>
  );
};

function Leyenda({ elementos }: { elementos: Array<{ color: string; texto: string; linea?: boolean }> }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
      {elementos.map((e) => (
        <span key={e.texto} className="inline-flex items-center gap-1.5">
          {e.linea ? (
            <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: e.color }} />
          ) : (
            <span className="inline-block w-3 h-3" style={{ backgroundColor: e.color }} />
          )}
          {e.texto}
        </span>
      ))}
    </div>
  );
}

function TablaDescriptivos({ filas }: { filas: Array<[string, Descriptivos | null]> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-600">
            <th className="py-2 pr-3 font-medium">Segmento</th>
            <th className="py-2 px-2 font-medium text-right">n</th>
            <th className="py-2 px-2 font-medium text-right">Media</th>
            <th className="py-2 px-2 font-medium text-right">Mediana</th>
            <th className="py-2 pl-2 font-medium text-right">DE</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(([nombre, d]) => (
            <tr key={nombre} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-3 text-slate-900">{nombre}</td>
              <td className="py-2 px-2 text-right">{d?.n ?? 0}</td>
              <td className="py-2 px-2 text-right">{num(d?.media, 2)}</td>
              <td className="py-2 px-2 text-right">{numOrden(d?.mediana)}</td>
              <td className="py-2 pl-2 text-right">{num(d?.desviacion, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        Rango general: {numOrden(filas[0][1]?.min)} a {numOrden(filas[0][1]?.max)} años · Q1 {numOrden(filas[0][1]?.q1)} · Q3{' '}
        {numOrden(filas[0][1]?.q3)}
      </p>
    </div>
  );
}
