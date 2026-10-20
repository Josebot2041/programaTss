import React, { useMemo, useState } from 'react';
import { Empleador, Titulado } from '../types';
import { LIKERT_EMPLEADOR, LIKERT_TITULADOS } from '../data/catalogos';
import { AFIRMACIONES_EMPLEADORES, AFIRMACIONES_RADAR, NOMBRE_CORTO_AFIRMACION } from '../data/strategicPlan';
import {
  analizarAspectosFormacion,
  analizarValoracionTitulados,
  codigoItem,
  indicePorItem,
  indicesPorDimension,
  type CampoValoracion
} from '../utils/analisis';
import type { TablaFrecuencias } from '../utils/estadistica';
import { num, pct, porcentaje, unirLista } from '../utils/formato';
import { COLOR_CATEGORIA } from '../ui/tema';
import { EncabezadoPagina, FilaKpi, Kpi, Panel, Seccion, Selector } from './ui/Estructura';
import { BarrasHorizontales } from './graficos/BarrasHorizontales';
import { BarrasApiladas, type SerieApilada } from './graficos/BarrasApiladas';
import { Radar } from './graficos/Radar';

interface TabCurriculumEvaluationProps {
  titulados: Titulado[];
  empleadores: Empleador[];
}

/** Nombre corto de cada ítem de valoración de los titulados. */
const NOMBRE_ITEM: Record<CampoValoracion, string> = {
  satisfaccion_global: 'Satisfacción global',
  concordancia_formacion: 'Concordancia con el mercado laboral',
  pertinencia_labores: 'Pertinencia de las labores',
  opinion_posgrado_fcyt: 'Posgrados afines en la FCyT'
};

/** Series de la escala de los titulados, de mayor a menor acuerdo. */
const SERIES_TITULADOS: SerieApilada[] = [...LIKERT_TITULADOS]
  .reverse()
  .map((nombre, i) => ({
    clave: String(4 - i),
    nombre,
    color: COLOR_CATEGORIA[nombre],
    colorTexto: nombre === 'De acuerdo' || nombre === 'En desacuerdo' ? '#1F2937' : '#FFFFFF'
  }));

const SERIES_EMPLEADORES: SerieApilada[] = LIKERT_EMPLEADOR.map((nombre) => ({
  clave: nombre,
  nombre,
  color: COLOR_CATEGORIA[nombre],
  colorTexto: nombre === 'Parcialmente de acuerdo' || nombre === 'No sabe' ? '#1F2937' : '#FFFFFF'
}));

const DIMENSIONES = ['Confianza y calidad del perfil', 'Conocimiento del perfil', 'Vinculación con empleadores', 'Participación en mejora de la carrera'] as const;

/** Redacción completa de algunas opciones abreviadas en la base (solo para las frases). */
const EN_FRASE: Record<string, string> = {
  'Actualización constante del plan': 'actualización constante del plan de estudios',
  'Relación con empresas (prácticas)': 'relación con empresas mediante prácticas',
  'Horarios para trabajadores / virtual': 'horarios para trabajadores o modalidad virtual'
};
const enFrase = (categoria: string) => EN_FRASE[categoria] ?? categoria.toLowerCase();

/** Barras de una pregunta de selección múltiple. */
const barras = (tabla: TablaFrecuencias) => tabla.filas.map((f) => ({ categoria: f.categoria, n: f.n, porcentaje: f.porcentaje }));
const mayor = (tabla: TablaFrecuencias) => [...tabla.filas].sort((a, b) => b.n - a.n)[0];

export const TabCurriculumEvaluation: React.FC<TabCurriculumEvaluationProps> = ({ titulados, empleadores }) => {
  const [dimension, setDimension] = useState<string>('Todas');

  const valoracion = useMemo(() => analizarValoracionTitulados(titulados), [titulados]);
  const aspectos = useMemo(() => analizarAspectosFormacion(titulados), [titulados]);
  const dimensiones = useMemo(() => indicesPorDimension(empleadores), [empleadores]);
  const porItem = useMemo(
    () =>
      AFIRMACIONES_EMPLEADORES.map((af) => ({
        ...af,
        corto: NOMBRE_CORTO_AFIRMACION[af.numero],
        resultado: indicePorItem(empleadores, codigoItem(af.numero))
      })),
    [empleadores]
  );

  // --- Valoración de los titulados
  const conDatos = valoracion.filter((v) => v.estadisticos !== null);
  const masAlta = [...conDatos].sort((a, b) => (b.estadisticos?.media ?? 0) - (a.estadisticos?.media ?? 0))[0];
  const masBaja = [...conDatos].sort((a, b) => (a.estadisticos?.media ?? 0) - (b.estadisticos?.media ?? 0))[0];
  const desacuerdo = (d: [number, number, number, number]) => porcentaje(d[0] + d[1], d[0] + d[1] + d[2] + d[3]);
  const masDesacuerdo = [...conDatos].sort(
    (a, b) => desacuerdo(b.estadisticos?.distribucion ?? [0, 0, 0, 0]) - desacuerdo(a.estadisticos?.distribucion ?? [0, 0, 0, 0])
  )[0];

  // --- Empleadores
  const radar = porItem.filter((p) => AFIRMACIONES_RADAR.includes(p.numero) && p.resultado.indice !== null);
  const radarOrdenado = [...radar].sort((a, b) => (b.resultado.indice ?? 0) - (a.resultado.indice ?? 0));
  const visibles = porItem.filter((p) => dimension === 'Todas' || p.dimension === dimension);
  const minimoVisible = [...visibles].sort((a, b) => (a.resultado.indice ?? 101) - (b.resultado.indice ?? 101))[0];
  const dimMasBaja = [...dimensiones].sort((a, b) => (a.indice ?? 101) - (b.indice ?? 101))[0];

  const fuenteTitulados = `encuesta a titulados, n = ${titulados.length}`;
  const fuenteEmpleadores = `encuesta a empleadores, n = ${empleadores.length}`;

  return (
    <div className="space-y-10">
      <EncabezadoPagina titulo="Plan de estudios" descripcion="Valoración de la formación según titulados y empleadores." />

      {/* Titulados */}
      <Seccion titulo="Valoración de los titulados" descripcion="Escala de 1 (totalmente en desacuerdo) a 4 (totalmente de acuerdo).">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Panel
            className="lg:col-span-3"
            titulo="Distribución de las respuestas"
            interpretacion={
              masDesacuerdo?.estadisticos
                ? `${NOMBRE_ITEM[masDesacuerdo.campo]} concentra el mayor desacuerdo: ${pct(desacuerdo(masDesacuerdo.estadisticos.distribucion))} responde en desacuerdo o totalmente en desacuerdo.`
                : undefined
            }
            fuente={fuenteTitulados}
          >
            <BarrasApiladas
              series={SERIES_TITULADOS}
              anchoEtiquetas={210}
              filas={conDatos.map((v) => ({
                categoria: NOMBRE_ITEM[v.campo],
                conteos: Object.fromEntries((v.estadisticos?.distribucion ?? [0, 0, 0, 0]).map((n, i) => [String(i + 1), n]))
              }))}
            />
          </Panel>

          <Panel
            className="lg:col-span-2"
            titulo="Medias y desviaciones estándar"
            interpretacion={
              masAlta?.estadisticos && masBaja?.estadisticos
                ? `${NOMBRE_ITEM[masAlta.campo]} tiene la media más alta y ${NOMBRE_ITEM[masBaja.campo].toLowerCase()} la más baja.`
                : undefined
            }
            fuente={`${fuenteTitulados}; la pertinencia solo la responden quienes trabajan`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2 pr-3 text-left font-medium">Ítem</th>
                    <th className="py-2 px-2 text-right font-medium">n</th>
                    <th className="py-2 px-2 text-right font-medium">Media</th>
                    <th className="py-2 px-2 text-right font-medium">DE</th>
                    <th className="py-2 pl-2 text-right font-medium">Acuerdo</th>
                  </tr>
                </thead>
                <tbody>
                  {valoracion.map(({ campo, estadisticos: e }) => (
                    <tr key={campo} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 text-slate-900">{NOMBRE_ITEM[campo]}</td>
                      <td className="py-2 px-2 text-right">{e?.n ?? 0}</td>
                      <td className="py-2 px-2 text-right">{num(e?.media, 2)}</td>
                      <td className="py-2 px-2 text-right">{num(e?.desviacion, 2)}</td>
                      <td className="py-2 pl-2 text-right">{pct(e?.porcentajeAcuerdo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-500">Acuerdo: respuestas 3 o 4.</p>
            </div>
          </Panel>
        </div>
      </Seccion>

      {/* Aspectos de la formación */}
      <Seccion titulo="Aspectos de la formación" descripcion="Preguntas de selección múltiple: los porcentajes suman más de 100%.">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel
            titulo="Lo más útil de la formación"
            interpretacion={mayor(aspectos.utiles) ? `Lo más valorado: ${enFrase(mayor(aspectos.utiles).categoria)} (${pct(mayor(aspectos.utiles).porcentaje)}).` : undefined}
            fuente={fuenteTitulados}
          >
            <BarrasHorizontales datos={barras(aspectos.utiles)} anchoEtiquetas={260} />
          </Panel>
          <Panel
            titulo="Lo que debe mejorar"
            interpretacion={mayor(aspectos.mejorar) ? `La mejora más pedida: ${enFrase(mayor(aspectos.mejorar).categoria)} (${pct(mayor(aspectos.mejorar).porcentaje)}).` : undefined}
            fuente={fuenteTitulados}
          >
            <BarrasHorizontales datos={barras(aspectos.mejorar)} anchoEtiquetas={230} />
          </Panel>
        </div>
      </Seccion>

      {/* Asignaturas */}
      <Seccion titulo="Asignaturas" descripcion="Materias que dieron ventaja competitiva y materias con poca utilidad en el trabajo.">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel
            titulo="Ventaja competitiva"
            interpretacion={
              mayor(aspectos.asignaturasVentaja)
                ? `${mayor(aspectos.asignaturasVentaja).categoria} es la más mencionada (${pct(mayor(aspectos.asignaturasVentaja).porcentaje)}).`
                : undefined
            }
            fuente={fuenteTitulados}
          >
            <BarrasHorizontales datos={barras(aspectos.asignaturasVentaja)} anchoEtiquetas={230} />
          </Panel>
          <Panel
            titulo="Poca utilidad"
            interpretacion={
              mayor(aspectos.asignaturasNoUtiles)
                ? `${mayor(aspectos.asignaturasNoUtiles).categoria} es la menos útil para el ${pct(mayor(aspectos.asignaturasNoUtiles).porcentaje)}.`
                : undefined
            }
            fuente={fuenteTitulados}
          >
            <BarrasHorizontales datos={barras(aspectos.asignaturasNoUtiles)} anchoEtiquetas={230} color="#4B5563" />
          </Panel>
        </div>
      </Seccion>

      {/* Empleadores */}
      <Seccion
        titulo="Valoración de los empleadores"
        descripcion="Índice de acuerdo de 0 a 100: (TA + 0.5 · PA) / n × 100, sin contar «No sabe». El índice de una dimensión es el promedio de sus afirmaciones."
      >
        <FilaKpi>
          {dimensiones.map((d, i) => (
            <Kpi
              key={d.dimension}
              valor={num(d.indice, 1)}
              etiqueta={DIMENSIONES[i]}
              contexto={`Afirmaciones ${unirLista(d.afirmaciones.map(String))}`}
            />
          ))}
        </FilaKpi>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel
            titulo="Valoración de los empleadores"
            interpretacion={
              radarOrdenado.length > 1
                ? `${radarOrdenado[0].corto} es lo mejor valorado; ${radarOrdenado[radarOrdenado.length - 1].corto.toLowerCase()}, lo más bajo del perfil.`
                : undefined
            }
            fuente={`${fuenteEmpleadores}; afirmaciones ${unirLista(AFIRMACIONES_RADAR.map(String))}`}
          >
            <Radar puntos={radar.map((p) => ({ eje: p.corto, valor: p.resultado.indice ?? 0 }))} />
          </Panel>

          <Panel
            titulo="Índice por afirmación"
            interpretacion={
              radar.length > 0
                ? `Las ${radar.length} afirmaciones del perfil promedian ${num(radar.reduce((s, p) => s + (p.resultado.indice ?? 0), 0) / radar.length, 1)} puntos.`
                : undefined
            }
            fuente={`${fuenteEmpleadores}; TA, PA y TD: totalmente de acuerdo, parcialmente de acuerdo y totalmente en desacuerdo`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2 pr-3 text-left font-medium">Afirmación</th>
                    <th className="py-2 px-2 text-right font-medium">TA</th>
                    <th className="py-2 px-2 text-right font-medium">PA</th>
                    <th className="py-2 px-2 text-right font-medium">TD</th>
                    <th className="py-2 px-2 text-right font-medium">n</th>
                    <th className="py-2 pl-2 text-right font-medium">Índice</th>
                  </tr>
                </thead>
                <tbody>
                  {radarOrdenado.map((p) => (
                    <tr key={p.numero} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 text-slate-900">
                        {p.numero}. {p.corto}
                      </td>
                      <td className="py-2 px-2 text-right">{p.resultado.totalmenteDeAcuerdo}</td>
                      <td className="py-2 px-2 text-right">{p.resultado.parcialmenteDeAcuerdo}</td>
                      <td className="py-2 px-2 text-right">{p.resultado.totalmenteEnDesacuerdo}</td>
                      <td className="py-2 px-2 text-right">{p.resultado.nValidas}</td>
                      <td className="py-2 pl-2 text-right font-semibold text-slate-900">{num(p.resultado.indice, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

          <Panel
            titulo="Respuestas a las 18 afirmaciones"
            interpretacion={
              minimoVisible && dimMasBaja
                ? `La dimensión más débil es ${DIMENSIONES[dimensiones.indexOf(dimMasBaja)].toLowerCase()}; «${minimoVisible.corto}» tiene el menor índice${dimension === 'Todas' ? '' : ' de la dimensión'} (${num(minimoVisible.resultado.indice, 1)}).`
                : undefined
            }
            fuente={`${fuenteEmpleadores}; sin contar respuestas en blanco`}
          >
            <div className="mb-4">
              <Selector
                etiqueta="Dimensión"
                valor={dimension}
                onCambiar={setDimension}
                opciones={[
                  { valor: 'Todas', texto: 'Todas' },
                  { valor: DIMENSIONES[0], texto: 'Confianza' },
                  { valor: DIMENSIONES[1], texto: 'Conocimiento' },
                  { valor: DIMENSIONES[2], texto: 'Vinculación' },
                  { valor: DIMENSIONES[3], texto: 'Participación' }
                ]}
              />
            </div>
            <BarrasApiladas
              series={SERIES_EMPLEADORES}
              anchoEtiquetas={210}
              filas={visibles.map((p) => ({
                categoria: `${p.numero}. ${p.corto}`,
                conteos: {
                  'Totalmente de acuerdo': p.resultado.totalmenteDeAcuerdo,
                  'Parcialmente de acuerdo': p.resultado.parcialmenteDeAcuerdo,
                  'Totalmente en desacuerdo': p.resultado.totalmenteEnDesacuerdo,
                  'No sabe': p.resultado.noSabe
                }
              }))}
            />
          </Panel>
      </Seccion>
    </div>
  );
};
