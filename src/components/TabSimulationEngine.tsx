import React, { useMemo, useState } from 'react';
import { Titulado } from '../types';
import {
  PARAMETROS_GENERADOR,
  parametrosDesdeBase,
  simularEscenarioA,
  simularEscenarioB,
  simularEscenarioC,
  SUPUESTOS_INFORME,
  validarGenerador,
  type Consumo,
  type Probabilidad,
  type SupuestosA,
  type SupuestosB,
  type SupuestosC
} from '../utils/simulacion';
import { entero, num, pct, textoP, unirLista } from '../utils/formato';
import { COLOR } from '../ui/tema';
import { EncabezadoPagina, Nota, Panel, Seccion, Selector } from './ui/Estructura';
import { BarrasIC } from './graficos/BarrasIC';
import { BarrasAgrupadas } from './graficos/BarrasAgrupadas';

type Vista = 'A' | 'B' | 'C' | 'generador';

interface TabSimulationEngineProps {
  titulados: Titulado[];
  vistaInicial?: Vista;
}

/** Semilla inicial de la vista del generador (la de cada escenario está en SUPUESTOS_INFORME). */
const SEMILLA_GENERADOR = 45217;

const TIEMPO_CORTO: Record<string, string> = {
  'Ya trabajaba antes de titularse': 'Ya trabajaba',
  'Menos de 1 mes': '< 1 mes',
  'Entre 1 - 4 meses': '1–4 meses',
  'Entre 4 - 8 meses': '4–8 meses',
  'Entre 8 - 12 meses': '8–12 meses',
  'Más de 12 meses': '> 12 meses'
};

export const TabSimulationEngine: React.FC<TabSimulationEngineProps> = ({ titulados, vistaInicial = 'A' }) => {
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const base = useMemo(() => parametrosDesdeBase(titulados), [titulados]);

  const [supA, setSupA] = useState<SupuestosA>(SUPUESTOS_INFORME.A);
  const [supB, setSupB] = useState<SupuestosB>(SUPUESTOS_INFORME.B);
  const [supC, setSupC] = useState<SupuestosC>(SUPUESTOS_INFORME.C);
  const [semillaGenerador, setSemillaGenerador] = useState<number>(SEMILLA_GENERADOR);

  const a = useMemo(() => simularEscenarioA(base, supA), [base, supA]);
  const b = useMemo(() => simularEscenarioB(base, supB), [base, supB]);
  const c = useMemo(() => simularEscenarioC(base, supC), [base, supC]);
  const v = useMemo(() => validarGenerador(semillaGenerador), [semillaGenerador]);

  const { a: pa, c: pc, m: pm } = PARAMETROS_GENERADOR;

  return (
    <div className="space-y-10">
      <EncabezadoPagina
        titulo="Escenarios de decisión"
        descripcion={`Simulación con el generador congruencial mixto Xₙ₊₁ = (${pa} · Xₙ + ${pc}) mod ${entero(pm)} y la transformada inversa. Las probabilidades salen de la base activa; los supuestos son editables. Cada titulado se simula con un único número aleatorio mediante la transformada inversa sobre la distribución conjunta de sus decisiones.`}
        acciones={
          <Selector<Vista>
            etiqueta="Escenario"
            valor={vista}
            onCambiar={setVista}
            opciones={[
              { valor: 'A', texto: 'A. Posgrados' },
              { valor: 'B', texto: 'B. Becas' },
              { valor: 'C', texto: 'C. Pasantías' },
              { valor: 'generador', texto: 'Generador' }
            ]}
          />
        }
      />

      {vista === 'A' && (
        <Seccion titulo="Escenario A: nuevos posgrados en la FCyT" descripcion="¿Cuántos inscritos puede esperar un programa de posgrado en cada área?">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Panel className="lg:col-span-2" titulo="Parámetros" fuente="encuesta a titulados; los supuestos son del informe">
              <TablaParametros>
                <FilaBase nombre="P(interés en un posgrado)" p={base.interes} />
                <FilaBase nombre="P(prefiere el Posgrado FCyT)" p={base.fcyt} />
                <FilaTexto nombre="Distribución por área" valor={`sobre ${base.totalAreas}`} origen="base" />
                <Campo nombre="Conversión en inscripción" valor={supA.conversion * 100} sufijo="%" min={1} max={100} onCambiar={(x) => setSupA({ ...supA, conversion: x / 100 })} />
                <Campo nombre="Mínimo de inscritos" valor={supA.umbral} min={1} max={200} onCambiar={(x) => setSupA({ ...supA, umbral: x })} />
                <Campo nombre="Titulados por réplica" valor={supA.poblacion} min={100} max={10000} paso={100} onCambiar={(x) => setSupA({ ...supA, poblacion: x })} />
                <Campo nombre="Réplicas" valor={supA.replicas} min={2} max={1000} onCambiar={(x) => setSupA({ ...supA, replicas: x })} />
                <CampoSemilla valor={supA.semilla} siguiente={a.consumo.siguienteSemilla} onCambiar={(x) => setSupA({ ...supA, semilla: x })} />
              </TablaParametros>
              <Contador consumo={a.consumo} porReplica={supA.poblacion} replicas={a.replicas} />
            </Panel>

            <Panel
              className="lg:col-span-3"
              titulo="Inscritos esperados por área (IC 95%)"
              interpretacion={textoA(a.areas, supA.umbral)}
              fuente={`${a.replicas} réplicas de ${entero(supA.poblacion)} titulados; intervalo t de Student`}
            >
              <BarrasIC
                datos={a.areas.map((r) => ({
                  categoria: r.area === 'Redes de Datos y Seguridad' ? 'Redes y Seguridad' : r.area === 'Ingeniería de Software' ? 'Ing. de Software' : r.area,
                  media: r.ic?.media ?? 0,
                  margen: r.ic?.margen ?? 0,
                  resaltar: r.decision !== 'Integrar como módulo'
                }))}
                referencia={{ valor: supA.umbral, texto: `Mínimo: ${supA.umbral}` }}
              />
            </Panel>
          </div>

          <Panel titulo="Resultados por área" fuente="la decisión se basa en el porcentaje de réplicas que alcanza el mínimo: 80% o más, viable; de 50% a 79%, viable con apoyo; menos de 50%, módulo">
            <TablaSimple
              encabezados={['Área', 'Media', 'IC 95%', 'Valor esperado', `Réplicas ≥ ${supA.umbral}`, 'Decisión']}
              alinear={['left', 'right', 'right', 'right', 'right', 'left']}
              filas={a.areas.map((r) => [
                r.area,
                num(r.ic?.media, 1),
                `[${num(r.ic?.inferior, 1)}, ${num(r.ic?.superior, 1)}]`,
                num(r.esperado, 1),
                pct(r.probabilidadUmbral),
                r.decision
              ])}
            />
          </Panel>
        </Seccion>
      )}

      {vista === 'B' && (
        <Seccion titulo="Escenario B: convenios de becas" descripcion="¿Cuánto crece la matrícula si aumenta la proporción de estudiantes con beca?">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Panel className="lg:col-span-2" titulo="Parámetros" fuente="encuesta a titulados; los supuestos son del informe">
              <TablaParametros>
                <FilaBase nombre="P(interés en un posgrado)" p={base.interes} />
                <FilaBase nombre="Becados actualmente" p={base.becaActual} />
                <FilaTexto nombre="P(inscribirse sin beca)" valor={num(b.probabilidadSinBeca, 3)} origen="P(FCyT) × conversión" />
                <FilaTexto nombre="P(inscribirse con beca)" valor={num(b.probabilidadConBeca, 3)} origen="sin beca × multiplicador" />
                <Campo nombre="Meta de becados" valor={supB.metaBecas * 100} sufijo="%" min={0} max={100} onCambiar={(x) => setSupB({ ...supB, metaBecas: x / 100 })} />
                <Campo nombre="Multiplicador con beca" valor={supB.multiplicadorBeca} min={1} max={9} paso={0.1} onCambiar={(x) => setSupB({ ...supB, multiplicadorBeca: x })} />
                <Campo nombre="Conversión en inscripción" valor={supB.conversion * 100} sufijo="%" min={1} max={100} onCambiar={(x) => setSupB({ ...supB, conversion: x / 100 })} />
                <Campo nombre="Titulados por réplica" valor={supB.poblacion} min={100} max={10000} paso={100} onCambiar={(x) => setSupB({ ...supB, poblacion: x })} />
                <Campo nombre="Réplicas" valor={supB.replicas} min={2} max={1000} onCambiar={(x) => setSupB({ ...supB, replicas: x })} />
                <CampoSemilla valor={supB.semilla} siguiente={b.consumo.siguienteSemilla} onCambiar={(x) => setSupB({ ...supB, semilla: x })} />
              </TablaParametros>
              <Contador consumo={b.consumo} porReplica={2 * supB.poblacion} replicas={b.replicas} />
            </Panel>

            <Panel
              className="lg:col-span-3"
              titulo="Inscritos en el Posgrado FCyT con y sin convenios (IC 95%)"
              interpretacion={
                b.actual && b.convenio && b.diferencia
                  ? `Con ${pct(supB.metaBecas * 100)} de becados, la matrícula pasa de ${num(b.actual.media, 1)} a ${num(b.convenio.media, 1)} inscritos (${b.incremento >= 0 ? '+' : ''}${pct(b.incremento)}); la diferencia ${b.diferencia.pValor < 0.05 ? 'es' : 'no es'} significativa.`
                  : undefined
              }
              fuente={`${b.replicas} réplicas de ${entero(supB.poblacion)} titulados por situación; intervalo t de Student`}
            >
              <BarrasIC
                datos={[
                  { categoria: `Situación actual (${pct(base.becaActual.valor * 100)} con beca)`, media: b.actual?.media ?? 0, margen: b.actual?.margen ?? 0 },
                  { categoria: `Con convenios (${pct(supB.metaBecas * 100)} con beca)`, media: b.convenio?.media ?? 0, margen: b.convenio?.margen ?? 0, resaltar: true }
                ]}
              />
            </Panel>
          </div>

          <Panel titulo="Resultados" fuente="prueba t de Welch para dos muestras independientes, α = 0.05">
            <TablaSimple
              encabezados={['Situación', 'Media de inscritos', 'IC 95%', 'Valor esperado']}
              alinear={['left', 'right', 'right', 'right']}
              filas={[
                ['Situación actual', num(b.actual?.media, 1), `[${num(b.actual?.inferior, 1)}, ${num(b.actual?.superior, 1)}]`, num(b.esperadoActual, 1)],
                ['Con convenios', num(b.convenio?.media, 1), `[${num(b.convenio?.inferior, 1)}, ${num(b.convenio?.superior, 1)}]`, num(b.esperadoConvenio, 1)],
                [
                  'Diferencia',
                  num(b.diferencia?.diferencia, 1),
                  `[${num(b.diferencia?.inferior, 1)}, ${num(b.diferencia?.superior, 1)}]`,
                  num(b.esperadoConvenio - b.esperadoActual, 1)
                ]
              ]}
            />
            <p className="mt-3 text-sm text-slate-700 tabular-nums">
              Welch: t = {num(b.diferencia?.t, 2)}, gl = {num(b.diferencia?.gl, 1)}, {textoP(b.diferencia?.pValor)}.
            </p>
          </Panel>
        </Seccion>
      )}

      {vista === 'C' && (
        <Seccion titulo="Escenario C: pasantías e inserción laboral" descripcion="¿Cuánto mejora la inserción si las pasantías adelantan el primer empleo de quienes hoy tardan más de 4 meses?">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Panel className="lg:col-span-2" titulo="Parámetros" fuente="encuesta a titulados; el supuesto es del informe">
              <TablaParametros>
                <FilaTexto nombre="Tiempo al primer empleo" valor={`sobre ${base.totalTiempos}`} origen="base" />
                <Campo
                  nombre="Más de 4 meses que pasa a «ya trabajaba»"
                  valor={supC.reduccion * 100}
                  sufijo="%"
                  min={0}
                  max={100}
                  onCambiar={(x) => setSupC({ ...supC, reduccion: x / 100 })}
                />
                <Campo nombre="Titulados por réplica" valor={supC.poblacion} min={100} max={10000} paso={100} onCambiar={(x) => setSupC({ ...supC, poblacion: x })} />
                <Campo nombre="Réplicas" valor={supC.replicas} min={2} max={1000} onCambiar={(x) => setSupC({ ...supC, replicas: x })} />
                <CampoSemilla valor={supC.semilla} siguiente={c.consumo.siguienteSemilla} onCambiar={(x) => setSupC({ ...supC, semilla: x })} />
              </TablaParametros>
              <Contador consumo={c.consumo} porReplica={2 * supC.poblacion} replicas={c.replicas} />
            </Panel>

            <Panel
              className="lg:col-span-3"
              titulo="Tiempo para conseguir el primer empleo: real y con más pasantías"
              interpretacion={
                c.rapidaReal && c.rapidaSimulada
                  ? `La inserción en 4 meses o menos sube de ${pct(c.rapidaReal.media)} a ${pct(c.rapidaSimulada.media)} (+${num(c.rapidaSimulada.media - c.rapidaReal.media, 1)} puntos).`
                  : undefined
              }
              fuente={`${c.replicas} réplicas de ${entero(supC.poblacion)} titulados por situación`}
            >
              <BarrasAgrupadas
                series={[
                  { clave: 'real', nombre: 'Situación real', color: COLOR.gris },
                  { clave: 'simulado', nombre: 'Con más pasantías', color: COLOR.azul }
                ]}
                datos={c.categorias.map((x) => ({ categoria: TIEMPO_CORTO[x.categoria] ?? x.categoria, real: x.pctReal, simulado: x.pctSimulado }))}
              />
            </Panel>
          </div>

          <Panel titulo="Inserción en 4 meses o menos" fuente="porcentaje por réplica; intervalo t de Student y prueba t de Welch, α = 0.05">
            <TablaSimple
              encabezados={['Situación', 'Media', 'IC 95%']}
              alinear={['left', 'right', 'right']}
              filas={[
                ['Real', pct(c.rapidaReal?.media), `[${pct(c.rapidaReal?.inferior)}, ${pct(c.rapidaReal?.superior)}]`],
                ['Con más pasantías', pct(c.rapidaSimulada?.media), `[${pct(c.rapidaSimulada?.inferior)}, ${pct(c.rapidaSimulada?.superior)}]`],
                [
                  'Diferencia (puntos)',
                  num(c.diferencia?.diferencia, 1),
                  `[${num(c.diferencia?.inferior, 1)}, ${num(c.diferencia?.superior, 1)}]`
                ]
              ]}
            />
            <p className="mt-3 text-sm text-slate-700 tabular-nums">
              Welch: t = {num(c.diferencia?.t, 2)}, gl = {num(c.diferencia?.gl, 1)}, {textoP(c.diferencia?.pValor)}.
            </p>
          </Panel>
        </Seccion>
      )}

      {vista === 'generador' && (
        <Seccion titulo="Generador y validación" descripcion={`Parámetros de la materia: a = ${pa}, c = ${pc}, m = ${entero(pm)}. Pruebas sobre ${entero(v.muestra)} números.`}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel titulo="Primeros números generados" fuente={`semilla X₀ = ${v.semilla}`}>
              <div className="mb-3">
                <CampoSemilla valor={semillaGenerador} siguiente={v.primeros[v.primeros.length - 1].x} onCambiar={setSemillaGenerador} enLinea />
              </div>
              <TablaSimple
                encabezados={['n', 'Xₙ', 'Uₙ']}
                alinear={['right', 'right', 'right']}
                filas={v.primeros.map((p) => [String(p.paso), entero(p.x), num(p.u, 5)])}
              />
            </Panel>

            <Panel
              className="lg:col-span-2"
              titulo="Pruebas del generador y del modelo"
              interpretacion={textoValidacion(v, a.ajusteAreas.ajusta, c.ajusteReal.ajusta)}
              fuente="α = 0.05; los ajustes del modelo comparan la simulación de los escenarios A y C con la base"
            >
              <TablaSimple
                encabezados={['Prueba', 'Esperado', 'Obtenido', 'Cumple']}
                alinear={['left', 'right', 'right', 'left']}
                filas={[
                  ['Período del generador', entero(pm), entero(v.periodo), v.periodo === pm ? 'Sí' : 'No'],
                  ['Media de U(0, 1)', '0.5000', num(v.media, 4), Math.abs(v.media - 0.5) < 0.01 ? 'Sí' : 'No'],
                  ['Varianza de U(0, 1)', '0.0833', num(v.varianza, 4), Math.abs(v.varianza - 1 / 12) < 0.005 ? 'Sí' : 'No'],
                  [
                    'Uniformidad (χ², 10 clases)',
                    `< ${num(v.uniformidad.valorCritico, 3)}`,
                    `${num(v.uniformidad.estadistico, 3)} (${textoP(v.uniformidad.pValor)})`,
                    v.uniformidad.ajusta ? 'Sí' : 'No'
                  ],
                  ['Independencia (corridas, |z|)', '< 1.96', num(Math.abs(v.corridas.z), 3), v.corridas.independiente ? 'Sí' : 'No'],
                  [
                    'Escenario A: áreas simuladas frente a la base (χ²)',
                    `< ${num(a.ajusteAreas.valorCritico, 3)}`,
                    `${num(a.ajusteAreas.estadistico, 3)} (${textoP(a.ajusteAreas.pValor)})`,
                    a.ajusteAreas.ajusta ? 'Sí' : 'No'
                  ],
                  [
                    'Escenario C: tiempos simulados frente a la base (χ²)',
                    `< ${num(c.ajusteReal.valorCritico, 3)}`,
                    `${num(c.ajusteReal.estadistico, 3)} (${textoP(c.ajusteReal.pValor)})`,
                    c.ajusteReal.ajusta ? 'Sí' : 'No'
                  ]
                ]}
              />
              <p className="mt-3 text-xs text-slate-500">
                Los p-valores tan altos indican un ajuste más uniforme que el de un azar ideal: es propio de un generador de período completo cuando se usa una fracción grande de su período.
              </p>
            </Panel>
          </div>
        </Seccion>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Textos generados
// ---------------------------------------------------------------------------

function textoA(areas: ReturnType<typeof simularEscenarioA>['areas'], umbral: number): string {
  const viables = areas.filter((r) => r.decision === 'Viable').map((r) => r.area);
  const apoyo = areas.filter((r) => r.decision === 'Viable con apoyo').map((r) => r.area);
  const modulos = areas.filter((r) => r.decision === 'Integrar como módulo').map((r) => r.area);
  const partes: string[] = [];
  if (viables.length > 0) partes.push(`${unirLista(viables)} alcanzan el mínimo de ${umbral} inscritos en al menos el 80% de las réplicas`);
  if (apoyo.length > 0) partes.push(`${unirLista(apoyo)} ${apoyo.length === 1 ? 'necesita' : 'necesitan'} apoyo`);
  if (modulos.length > 0) partes.push(`conviene ofrecer ${unirLista(modulos)} como módulos`);
  return partes.length > 0 ? `${partes.join('; ')}.` : '';
}

function textoValidacion(v: ReturnType<typeof validarGenerador>, ajusteA: boolean, ajusteC: boolean): string {
  const generadorOk = v.periodo === PARAMETROS_GENERADOR.m && v.uniformidad.ajusta && v.corridas.independiente;
  const modeloOk = ajusteA && ajusteC;
  if (generadorOk && modeloOk) return 'El generador tiene período completo, pasa las pruebas de uniformidad e independencia, y la simulación reproduce las distribuciones de la base.';
  if (generadorOk) return 'El generador pasa sus pruebas, pero la simulación no reproduce alguna distribución de la base: revise los parámetros.';
  return 'El generador no pasa alguna prueba con esta semilla.';
}

// ---------------------------------------------------------------------------
// Componentes de la pestaña
// ---------------------------------------------------------------------------

function TablaParametros({ children }: { children: React.ReactNode }) {
  return (
    <table className="w-full text-sm">
      <tbody>{children}</tbody>
    </table>
  );
}

function FilaTexto({ nombre, valor, origen }: { nombre: string; valor: string; origen: string }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-2 text-slate-700">
        {nombre}
        <span className="block text-xs text-slate-500">{origen}</span>
      </td>
      <td className="py-2 pl-2 text-right text-slate-900 tabular-nums">{valor}</td>
    </tr>
  );
}

function FilaBase({ nombre, p }: { nombre: string; p: Probabilidad }) {
  return <FilaTexto nombre={nombre} valor={num(p.valor, 3)} origen={`base: ${p.n} de ${p.total}`} />;
}

function Campo({
  nombre,
  valor,
  onCambiar,
  min,
  max,
  paso = 1,
  sufijo
}: {
  nombre: string;
  valor: number;
  onCambiar: (v: number) => void;
  min: number;
  max: number;
  paso?: number;
  sufijo?: string;
}) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-2 text-slate-700">
        <label htmlFor={`campo-${nombre}`}>{nombre}</label>
        <span className="block text-xs text-slate-500">supuesto</span>
      </td>
      <td className="py-2 pl-2 text-right whitespace-nowrap">
        <input
          id={`campo-${nombre}`}
          type="number"
          min={min}
          max={max}
          step={paso}
          value={Number(valor.toFixed(6))}
          onChange={(e) => {
            const x = Number(e.target.value);
            if (Number.isFinite(x)) onCambiar(Math.min(max, Math.max(min, x)));
          }}
          className="w-20 border border-slate-300 rounded px-2 py-1 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-institucional"
        />
        {sufijo && <span className="ml-1 text-slate-500">{sufijo}</span>}
      </td>
    </tr>
  );
}

function CampoSemilla({
  valor,
  siguiente,
  onCambiar,
  enLinea = false
}: {
  valor: number;
  siguiente: number;
  onCambiar: (v: number) => void;
  enLinea?: boolean;
}) {
  const controles = (
    <div className="flex items-center justify-end gap-2">
      <input
        type="number"
        min={0}
        max={PARAMETROS_GENERADOR.m - 1}
        value={valor}
        aria-label="Semilla"
        onChange={(e) => {
          const x = Math.floor(Number(e.target.value));
          if (Number.isFinite(x)) onCambiar(Math.min(PARAMETROS_GENERADOR.m - 1, Math.max(0, x)));
        }}
        className="w-24 border border-slate-300 rounded px-2 py-1 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-institucional"
      />
      <button onClick={() => onCambiar(siguiente)} className="text-xs text-institucional hover:underline whitespace-nowrap" title="Usar el último X generado como semilla">
        Siguiente
      </button>
    </div>
  );
  if (enLinea) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-slate-700">Semilla X₀</span>
        {controles}
      </div>
    );
  }
  return (
    <tr>
      <td className="py-2 pr-2 text-slate-700">
        Semilla X₀
        <span className="block text-xs text-slate-500">fija y reproducible</span>
      </td>
      <td className="py-2 pl-2">{controles}</td>
    </tr>
  );
}

/** Contador de números usados frente al período del generador. */
function Contador({ consumo, porReplica, replicas }: { consumo: Consumo; porReplica: number; replicas: number }) {
  const uso = (100 * consumo.usados) / consumo.periodo;
  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-slate-700">Números usados</span>
        <span className="text-slate-900 tabular-nums">
          {entero(consumo.usados)} / {entero(consumo.periodo)}
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={consumo.periodo} aria-valuenow={consumo.usados} aria-label="Números usados del período">
        <div className="h-full bg-institucional" style={{ width: `${Math.min(100, uso)}%` }} />
      </div>
      <p className="text-xs text-slate-500">
        {entero(porReplica)} números por réplica × {replicas} réplicas = {pct(uso)} del período.
      </p>
      {consumo.replicasAjustadas && (
        <Nota tono="resalte">
          Las {consumo.replicasPedidas} réplicas pedidas no caben en un período; se simularon {consumo.replicasMaximas} para no repetir la secuencia.
        </Nota>
      )}
    </div>
  );
}

function TablaSimple({ encabezados, filas, alinear }: { encabezados: string[]; filas: string[][]; alinear: Array<'left' | 'right'> }) {
  const clase = (i: number) => (alinear[i] === 'right' ? 'text-right' : 'text-left');
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-slate-200 text-slate-600">
            {encabezados.map((e, i) => (
              <th key={e} className={`py-2 px-2 first:pl-0 last:pr-0 font-medium ${clase(i)}`}>
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, f) => (
            <tr key={f} className="border-b border-slate-100 last:border-0">
              {fila.map((celda, i) => (
                <td key={i} className={`py-2 px-2 first:pl-0 last:pr-0 ${i === 0 ? 'text-slate-900' : 'text-slate-700'} ${clase(i)}`}>
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
