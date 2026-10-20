import React, { useMemo, useState } from 'react';
import { Titulado } from '../types';
import { PRUEBAS_INDEPENDENCIA, tablaAreaInstitucion, type DefinicionPrueba } from '../utils/analisis';
import {
  crearTablaCruzada,
  NOMBRE_METODO,
  pruebaIndependencia,
  type MetodoOficial,
  type PruebaIndependencia,
  type TablaCruzada
} from '../utils/estadistica';
import { num, pct, porcentaje, textoP, unirDos, unirLista } from '../utils/formato';
import { EncabezadoPagina, Nota, Panel, Seccion, Selector } from './ui/Estructura';
import { MapaCalor } from './graficos/MapaCalor';

interface TabChiSquareAnalysisProps {
  titulados: Titulado[];
}

const ALFA = 0.05;

/** p-valor con 4 decimales (o "< 0.0001"). */
const pValor = (p: number | null | undefined) => (p === null || p === undefined ? '—' : p < 0.0001 ? '< 0.0001' : p.toFixed(4));

/** Porcentaje de la columna `j` dentro de la fila `i`. */
const pctFila = (t: TablaCruzada, i: number, j: number) => porcentaje(t.observadas[i][j], t.totalesFila[i]);

/** Interpretación de los datos de cada prueba (una línea, generada con la tabla). */
function interpretarTabla(id: string, t: TablaCruzada): string {
  switch (id) {
    case 'nivel-financiamiento':
      return `Pagaron con recursos propios ${t.observadas[0][0]} de ${t.totalesFila[0]} en Diplomado (${pct(pctFila(t, 0, 0))}) y ${t.observadas[1][0]} de ${t.totalesFila[1]} en Especialidad, Maestría o Doctorado (${pct(pctFila(t, 1, 0))}).`;
    case 'edad-formacion':
      return `Cursó un posgrado el ${pct(pctFila(t, 0, 0))} de los titulados de 30 años o menos y el ${pct(pctFila(t, 1, 0))} de los mayores de 30.`;
    case 'sector-remuneracion':
      return `Gana más de Bs. 7 000 el ${pct(pctFila(t, 0, 1))} en el sector privado y el ${pct(pctFila(t, 1, 1))} en el público.`;
    case 'area-institucion': {
      const otras = t.filas.filter((_, i) => t.observadas[i].indexOf(Math.max(...t.observadas[i])) !== 0);
      return otras.length === 0
        ? 'La UMSS es la institución preferida en todas las áreas.'
        : `La UMSS es la institución preferida en ${t.filas.length - otras.length} de ${t.filas.length} áreas; la excepción es ${unirLista(otras)}.`;
    }
    default:
      return '';
  }
}

/** Lectura convencional de la V de Cramér. */
function intensidad(v: number): string {
  if (v < 0.1) return 'despreciable';
  if (v < 0.3) return 'débil';
  if (v < 0.5) return 'moderada';
  return 'fuerte';
}

/** Una línea con la decisión estadística del resultado oficial. */
function textoDecision(p: PruebaIndependencia, def?: DefinicionPrueba): string {
  const variables = def ? unirDos(def.variableFilas.toLowerCase(), def.variableColumnas.toLowerCase()) : 'las variables';
  return p.rechazaH0
    ? `Se rechaza H₀ (${textoP(p.pValorOficial)} < ${ALFA}): hay asociación entre ${variables}, de intensidad ${intensidad(p.vCramer)} (V = ${num(p.vCramer, 3)}).`
    : `No se rechaza H₀ (${textoP(p.pValorOficial)} ≥ ${ALFA}): no hay evidencia de asociación entre ${variables}.`;
}

/** Explica por qué se eligió el resultado oficial cuando hay frecuencias esperadas bajas. */
function textoEsperadas(p: PruebaIndependencia): string | null {
  const { celdasEsperadaMenor5: k, totalCeldas, esperadaMinima } = p.sinCorreccion;
  if (k === 0) return null;
  const celdas = `${k} de ${totalCeldas} celdas ${k === 1 ? 'tiene' : 'tienen'} frecuencia esperada menor que 5 (mínima ${num(esperadaMinima, 2)})`;
  if (p.es2x2) return `${celdas}: por eso el resultado oficial es la prueba exacta de Fisher.`;
  return p.aproximacionAdecuada
    ? `${celdas}; son como máximo el 20% de las celdas, así que la aproximación chi-cuadrado es aceptable.`
    : `${celdas}; superan el 20% de las celdas y el resultado chi-cuadrado no es confiable. Conviene agrupar categorías.`;
}

export const TabChiSquareAnalysis: React.FC<TabChiSquareAnalysisProps> = ({ titulados }) => {
  const [seleccion, setSeleccion] = useState<string>(PRUEBAS_INDEPENDENCIA[0].id);

  const resultados = useMemo(
    () =>
      PRUEBAS_INDEPENDENCIA.map((def) => {
        const tabla = def.construir(titulados);
        return { def, tabla, prueba: pruebaIndependencia(tabla, ALFA) };
      }),
    [titulados]
  );
  const mapa = useMemo(() => tablaAreaInstitucion(titulados), [titulados]);

  const actual = resultados.find((r) => r.def.id === seleccion) ?? resultados[0];
  const significativas = resultados.filter((r) => r.prueba?.rechazaH0);

  return (
    <div className="space-y-10">
      <EncabezadoPagina
        titulo="Pruebas de independencia"
        descripcion={`Chi-cuadrado sobre tablas cruzadas de la base, con α = ${ALFA}. En tablas 2×2 el resultado oficial es Fisher si alguna frecuencia esperada es menor que 5 y, si no, chi-cuadrado con corrección de Yates.`}
      />

      <Seccion titulo="Resumen de las pruebas">
        <Panel
          titulo="Resultados por relación"
          interpretacion={
            significativas.length === 0
              ? 'Ninguna de las relaciones evaluadas es significativa.'
              : `${significativas.length} de ${resultados.length} relaciones ${significativas.length === 1 ? 'es significativa' : 'son significativas'}: ${unirLista(significativas.map((r) => r.def.relacion.toLowerCase()))}.`
          }
          fuente="encuesta a titulados"
        >
          <TablaResumen resultados={resultados} />
          <p className="mt-2 text-xs text-slate-500">Sombreado: resultado oficial de cada prueba. V: V de Cramér del chi-cuadrado oficial.</p>
        </Panel>
      </Seccion>

      <Seccion titulo="Detalle de una prueba">
        <Selector
          etiqueta="Prueba"
          valor={seleccion}
          onCambiar={setSeleccion}
          opciones={PRUEBAS_INDEPENDENCIA.map((d) => ({ valor: d.id, texto: d.nombre }))}
        />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Panel
            className="lg:col-span-3"
            titulo={actual.def.relacion}
            interpretacion={actual.tabla.total > 0 ? interpretarTabla(actual.def.id, actual.tabla) : undefined}
            fuente={`${actual.def.poblacion}, n = ${actual.tabla.total}`}
          >
            <div className="space-y-5">
              <TablaFrecuencias titulo="Frecuencias observadas" tabla={actual.tabla} etiquetaFilas={actual.def.variableFilas} />
              {actual.prueba && (
                <TablaFrecuencias
                  titulo="Frecuencias esperadas bajo H₀"
                  tabla={actual.tabla}
                  esperadas={actual.prueba.sinCorreccion.esperadas}
                  etiquetaFilas={actual.def.variableFilas}
                />
              )}
            </div>
          </Panel>

          <Panel className="lg:col-span-2" titulo="Resultado">
            {actual.prueba ? (
              <BloqueResultados prueba={actual.prueba} def={actual.def} />
            ) : (
              <p className="text-sm text-slate-600">La tabla no tiene datos suficientes para la prueba.</p>
            )}
          </Panel>
        </div>
      </Seccion>

      <Seccion titulo="Mapa de calor">
        <Panel
          titulo="Área de interés según institución preferida"
          interpretacion={interpretarTabla('area-institucion', mapa)}
          fuente={`titulados interesados en un posgrado, n = ${mapa.total}`}
        >
          <MapaCalor tabla={mapa} etiquetaFilas="Área de interés" />
        </Panel>
      </Seccion>

      <Seccion titulo="Calculadora 2×2" descripcion="Prueba de independencia para cualquier tabla 2×2, con la misma regla de decisión.">
        <Calculadora inicial={resultados[0].tabla.observadas} />
      </Seccion>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Componentes de la pestaña
// ---------------------------------------------------------------------------

function TablaResumen({
  resultados
}: {
  resultados: Array<{ def: DefinicionPrueba; tabla: TablaCruzada; prueba: PruebaIndependencia | null }>;
}) {
  const celda = (activa: boolean) =>
    `py-2.5 px-3 text-right whitespace-nowrap ${activa ? 'bg-institucional-fondo font-semibold text-slate-900' : 'text-slate-700'}`;
  const estadisticoYP = (estadistico: number | undefined, p: number | undefined) =>
    estadistico === undefined ? '—' : `${num(estadistico, 3)} (${pValor(p)})`;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-slate-200 text-slate-600">
            <th className="py-2 pr-3 text-left font-medium">Relación</th>
            <th className="py-2 px-3 text-right font-medium">n</th>
            <th className="py-2 px-3 text-right font-medium">gl</th>
            <th className="py-2 px-3 text-right font-medium">χ² sin corrección (p)</th>
            <th className="py-2 px-3 text-right font-medium">χ² Yates (p)</th>
            <th className="py-2 px-3 text-right font-medium">Fisher (p)</th>
            <th className="py-2 px-3 text-right font-medium">V</th>
            <th className="py-2 pl-3 text-left font-medium">Decisión</th>
          </tr>
        </thead>
        <tbody>
          {resultados.map(({ def, tabla, prueba }) => {
            const oficial: MetodoOficial | undefined = prueba?.metodoOficial;
            return (
              <tr key={def.id} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 pr-3 text-slate-900">
                  {def.relacion}
                  {prueba?.hayEsperadaMenor5 && (
                    <span className="block text-xs text-slate-500">
                      {prueba.sinCorreccion.celdasEsperadaMenor5} de {prueba.sinCorreccion.totalCeldas} celdas con E &lt; 5
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right">{tabla.total}</td>
                <td className="py-2.5 px-3 text-right">{prueba?.sinCorreccion.gl ?? '—'}</td>
                <td className={celda(oficial === 'chi2')}>{estadisticoYP(prueba?.sinCorreccion.estadistico, prueba?.sinCorreccion.pValor)}</td>
                <td className={celda(oficial === 'yates')}>{estadisticoYP(prueba?.yates?.estadistico, prueba?.yates?.pValor)}</td>
                <td className={celda(oficial === 'fisher')}>{prueba?.fisher ? pValor(prueba.fisher.pValor) : '—'}</td>
                <td className="py-2.5 px-3 text-right">{num(prueba?.vCramer, 3)}</td>
                <td className="py-2.5 pl-3 text-slate-900 whitespace-nowrap">
                  {!prueba ? '—' : prueba.rechazaH0 ? 'Se rechaza H₀' : 'No se rechaza H₀'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TablaFrecuencias({
  titulo,
  tabla,
  esperadas,
  etiquetaFilas
}: {
  titulo: string;
  tabla: TablaCruzada;
  esperadas?: number[][];
  etiquetaFilas: string;
}) {
  const valor = (i: number, j: number) => (esperadas ? num(esperadas[i][j], 2) : String(tabla.observadas[i][j]));
  const bajo = (i: number, j: number) => esperadas !== undefined && esperadas[i][j] < 5;
  return (
    <div>
      <h4 className="mb-1.5 text-sm font-medium text-slate-700">{titulo}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600">
              <th className="py-1.5 pr-3 text-left font-medium">{etiquetaFilas}</th>
              {tabla.columnas.map((c) => (
                <th key={c} className="py-1.5 px-2 text-right font-medium">
                  {c}
                </th>
              ))}
              <th className="py-1.5 pl-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map((f, i) => (
              <tr key={f} className="border-b border-slate-100">
                <td className="py-1.5 pr-3 text-slate-900">{f}</td>
                {tabla.columnas.map((c, j) => (
                  <td key={c} className={`py-1.5 px-2 text-right ${bajo(i, j) ? 'text-resalte font-semibold' : 'text-slate-700'}`}>
                    {valor(i, j)}
                  </td>
                ))}
                <td className="py-1.5 pl-2 text-right text-slate-600">{tabla.totalesFila[i]}</td>
              </tr>
            ))}
            <tr>
              <td className="py-1.5 pr-3 text-slate-600">Total</td>
              {tabla.totalesColumna.map((t, j) => (
                <td key={tabla.columnas[j]} className="py-1.5 px-2 text-right text-slate-600">
                  {t}
                </td>
              ))}
              <td className="py-1.5 pl-2 text-right text-slate-600">{tabla.total}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {esperadas && esperadas.flat().some((e) => e < 5) && (
        <p className="mt-1 text-xs text-slate-500">En naranja, las frecuencias esperadas menores que 5.</p>
      )}
    </div>
  );
}

function BloqueResultados({ prueba, def }: { prueba: PruebaIndependencia; def?: DefinicionPrueba }) {
  const filas: Array<{ metodo: MetodoOficial; valor: string; aplica: boolean }> = [
    {
      metodo: 'chi2',
      valor: `χ² = ${num(prueba.sinCorreccion.estadistico, 3)} · p = ${pValor(prueba.sinCorreccion.pValor)}`,
      aplica: true
    },
    {
      metodo: 'yates',
      valor: prueba.yates ? `χ² = ${num(prueba.yates.estadistico, 3)} · p = ${pValor(prueba.yates.pValor)}` : 'Solo para tablas 2×2',
      aplica: prueba.yates !== null
    },
    {
      metodo: 'fisher',
      valor: prueba.fisher ? `p = ${pValor(prueba.fisher.pValor)}` : 'Solo para tablas 2×2',
      aplica: prueba.fisher !== null
    }
  ];
  const aviso = textoEsperadas(prueba);
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {filas.map((f) => {
          const oficial = f.metodo === prueba.metodoOficial;
          return (
            <li key={f.metodo} className={`border-l-4 px-3 py-2 ${oficial ? 'border-institucional bg-institucional-fondo' : 'border-slate-200'}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className={`text-sm ${oficial ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{NOMBRE_METODO[f.metodo]}</span>
                {oficial && <span className="text-xs text-institucional">Resultado oficial</span>}
              </div>
              <div className={`text-sm tabular-nums ${f.aplica ? 'text-slate-900' : 'text-slate-400'}`}>{f.valor}</div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate-500 tabular-nums">
        gl = {prueba.sinCorreccion.gl} · valor crítico χ² = {num(prueba.sinCorreccion.valorCritico, 3)} (α = {ALFA}) · V = {num(prueba.vCramer, 3)}
      </p>
      {aviso && <Nota tono="resalte">{aviso}</Nota>}
      <p className="text-sm text-slate-800">{textoDecision(prueba, def)}</p>
    </div>
  );
}

function Calculadora({ inicial }: { inicial: number[][] }) {
  const [matriz, setMatriz] = useState<number[][]>(() => inicial.map((f) => [...f]));
  const tabla = crearTablaCruzada(['Fila 1', 'Fila 2'], ['Columna 1', 'Columna 2'], matriz);
  const prueba = pruebaIndependencia(tabla, ALFA);

  const cambiar = (i: number, j: number, texto: string) => {
    const valor = Math.max(0, Math.floor(Number(texto) || 0));
    setMatriz((m) => m.map((fila, fi) => fila.map((v, cj) => (fi === i && cj === j ? valor : v))));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <Panel className="lg:col-span-2" titulo="Frecuencias observadas" interpretacion="Valores iniciales: nivel del programa × financiamiento.">
        <table className="text-sm tabular-nums">
          <thead>
            <tr className="text-slate-600">
              <th />
              {tabla.columnas.map((c) => (
                <th key={c} className="px-2 pb-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map((f, i) => (
              <tr key={f}>
                <td className="pr-3 py-1 text-slate-700">{f}</td>
                {matriz[i].map((v, j) => (
                  <td key={j} className="px-2 py-1">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={v}
                      aria-label={`${f}, ${tabla.columnas[j]}`}
                      onChange={(e) => cambiar(i, j, e.target.value)}
                      className="w-20 border border-slate-300 rounded px-2 py-1.5 text-right focus:outline-none focus:ring-1 focus:ring-institucional"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel className="lg:col-span-3" titulo="Resultado">
        {prueba ? (
          <BloqueResultados prueba={prueba} />
        ) : (
          <p className="text-sm text-slate-600">Cada fila y cada columna necesita un total mayor que cero.</p>
        )}
      </Panel>
    </div>
  );
}
