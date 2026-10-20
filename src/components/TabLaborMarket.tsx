import React, { useMemo, useState } from 'react';
import { Titulado, Empleador } from '../types';
import { REMUNERACIONES, SECTORES } from '../data/catalogos';
import { analizarEmpleadores, analizarMercadoTitulados } from '../utils/analisis';
import type { TablaFrecuencias } from '../utils/estadistica';
import { pct, unirDos, unirLista } from '../utils/formato';
import { COLOR_CATEGORIA } from '../ui/tema';
import { EncabezadoPagina, FilaKpi, Kpi, Panel, Seccion, Selector } from './ui/Estructura';
import { BarrasHorizontales } from './graficos/BarrasHorizontales';
import { BarrasAgrupadas } from './graficos/BarrasAgrupadas';
import { Radar } from './graficos/Radar';

type Vista = 'titulados' | 'empleadores';

interface TabLaborMarketProps {
  titulados: Titulado[];
  empleadores: Empleador[];
  vistaInicial?: Vista;
}

/** Tramos de remuneración abreviados para el eje del gráfico. */
const TRAMO_CORTO: Record<(typeof REMUNERACIONES)[number], string> = {
  'Menor a Bs. 2.500': '< 2 500',
  'Entre Bs. 2.500 - Bs. 3.500': '2 500–3 500',
  'Entre Bs. 3.501 - Bs. 5.000': '3 501–5 000',
  'Entre Bs. 5.001 - Bs. 7.000': '5 001–7 000',
  'Entre Bs. 7.001 - Bs. 10.000': '7 001–10 000',
  'Más de Bs. 10.000': '> 10 000'
};

/** Redacción corta de las razones para no trabajar (gráfico y frase). */
const RAZON_CORTA: Record<string, string> = {
  'Incumplimiento de requisitos en habilidades específicas (idiomas, softwares, etc)': 'Requisitos de habilidades específicas',
  'Incumplimiento de requisitos de experiencia previa': 'Requisitos de experiencia previa',
  'Ofertas laborales con remuneración muy bajas': 'Ofertas con remuneración muy baja'
};
const razonCorta = (r: string) => RAZON_CORTA[r] ?? r;

const barras = (tabla: TablaFrecuencias, omitirCeros = true) =>
  tabla.filas.filter((f) => !omitirCeros || f.n > 0).map((f) => ({ categoria: f.categoria, n: f.n, porcentaje: f.porcentaje }));
const mayor = (tabla: TablaFrecuencias) => [...tabla.filas].sort((a, b) => b.n - a.n)[0];
const buscar = (tabla: TablaFrecuencias, categoria: string) => tabla.filas.find((f) => f.categoria === categoria);

export const TabLaborMarket: React.FC<TabLaborMarketProps> = ({ titulados, empleadores, vistaInicial = 'titulados' }) => {
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const m = useMemo(() => analizarMercadoTitulados(titulados), [titulados]);
  const e = useMemo(() => analizarEmpleadores(empleadores), [empleadores]);

  const fuenteTitulados = `encuesta a titulados, n = ${titulados.length}`;
  const fuenteEmpleadores = `encuesta a empleadores, n = ${empleadores.length}`;

  // --- Titulados
  const noTrabaja = buscar(m.situaciones, 'No trabaja');
  const rubroMayor = mayor(m.rubros);
  const cargoMayor = mayor(m.cargos);
  const privado = m.remuneracionPorSector.find((r) => r.sector === 'Privado')?.tabla;
  const publico = m.remuneracionPorSector.find((r) => r.sector === 'Público')?.tabla;
  const masDe7000 = (t?: TablaFrecuencias) =>
    t ? (t.filas.filter((f) => f.categoria === 'Entre Bs. 7.001 - Bs. 10.000' || f.categoria === 'Más de Bs. 10.000').reduce((s, f) => s + f.n, 0) * 100) / (t.total || 1) : 0;
  const razonMayor = mayor(m.razonesNoTrabaja);
  const emp = m.emprendimiento;
  const idea = (buscar(emp.origen, 'Idea propia')?.n ?? 0) + (buscar(emp.origen, 'Idea conjunta con compañeros')?.n ?? 0);
  const importante = (buscar(emp.importancia, 'Muy importante')?.n ?? 0) + (buscar(emp.importancia, 'Importante')?.n ?? 0);
  const propio = buscar(emp.financiamiento, 'No, financiamiento propio');
  const satisfecho = buscar(emp.satisfaccion, 'Satisfecho');
  const tardanza = m.tiempos.filas.filter((f) => f.categoria === 'Más de 12 meses' || f.categoria === 'Entre 8 - 12 meses');

  // --- Empleadores
  const tecnologias = [...e.tecnologias.temas].sort((a, b) => b.n - a.n);
  const masDeMitad = tecnologias.filter((t) => t.porcentaje > 50);
  const habilidades = [...e.habilidades.temas].sort((a, b) => b.n - a.n);
  const rubroEmpleador = mayor(e.rubros);
  const tamanoMayor = mayor(e.tamanos);
  const licenciatura = buscar(e.niveles, 'Licenciatura');
  const medioMayor = mayor(e.medios);
  const cargoEmpleador = mayor(e.cargos);
  const noPrevista = buscar(e.posibilidad, 'No prevista actualmente');

  return (
    <div className="space-y-10">
      <EncabezadoPagina
        titulo="Mercado laboral"
        descripcion="Inserción laboral de los titulados y demanda de los empleadores."
        acciones={
          <Selector<Vista>
            etiqueta="Vista"
            valor={vista}
            onCambiar={setVista}
            opciones={[
              { valor: 'titulados', texto: `Titulados (${titulados.length})` },
              { valor: 'empleadores', texto: `Empleadores (${empleadores.length})` }
            ]}
          />
        }
      />

      {vista === 'titulados' && (
        <>
          <Seccion titulo="Situación laboral">
            <FilaKpi>
              <Kpi valor={pct(m.ocupacion.porcentaje)} etiqueta="Tasa de ocupación" contexto={`trabaja o emprende: ${m.ocupacion.n} de ${m.ocupacion.total}`} />
              <Kpi
                valor={pct(m.yaTrabajaba.porcentaje)}
                etiqueta="Ya trabajaba al titularse"
                contexto={`${m.yaTrabajaba.n} de ${m.yaTrabajaba.total} con dato`}
              />
              <Kpi
                valor={pct(buscar(m.sectorEnOrganizacion, 'Privado')?.porcentaje)}
                etiqueta="Trabaja en el sector privado"
                contexto={`de ${m.sectorEnOrganizacion.total} que trabajan en una organización`}
              />
              <Kpi
                valor={pct(m.remuneracionAlta.porcentaje)}
                etiqueta="Gana más de Bs. 7 000"
                contexto={`${m.remuneracionAlta.n} de ${m.remuneracionAlta.total} que informaron su remuneración`}
              />
            </FilaKpi>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel
                titulo="Situación laboral actual"
                interpretacion={noTrabaja ? `El ${pct(noTrabaja.porcentaje)} no trabaja actualmente (${noTrabaja.n} titulados).` : undefined}
                fuente={fuenteTitulados}
              >
                <BarrasHorizontales datos={barras(m.situaciones, false)} anchoEtiquetas={200} />
              </Panel>
              <Panel
                titulo="Tiempo para conseguir el primer empleo"
                interpretacion={`El ${pct(m.insercionRapida.porcentaje)} consiguió empleo en 4 meses o menos; el ${pct(
                  tardanza.reduce((s, f) => s + f.porcentaje, 0)
                )} tardó más de 8 meses.`}
                fuente={`titulados que trabajan, n = ${m.tiempos.total} con dato`}
              >
                <BarrasHorizontales datos={barras(m.tiempos, false)} anchoEtiquetas={210} resaltar={tardanza.map((f) => f.categoria)} />
              </Panel>
            </div>
          </Seccion>

          <Seccion titulo="Empleo y remuneración">
            <Panel
              titulo="Remuneración mensual según sector"
              interpretacion={`Gana más de Bs. 7 000 el ${pct(masDe7000(privado))} en el sector privado y el ${pct(masDe7000(publico))} en el público.`}
              fuente={`titulados que informaron su remuneración: privado n = ${privado?.total ?? 0}, público n = ${publico?.total ?? 0}`}
            >
              <BarrasAgrupadas
                series={SECTORES.map((s) => ({ clave: s, nombre: `Sector ${s.toLowerCase()}`, color: COLOR_CATEGORIA[s] }))}
                datos={REMUNERACIONES.map((r) => ({
                  categoria: TRAMO_CORTO[r],
                  Privado: buscar(privado ?? { total: 0, filas: [] }, r)?.porcentaje ?? 0,
                  Público: buscar(publico ?? { total: 0, filas: [] }, r)?.porcentaje ?? 0
                }))}
              />
              <p className="mt-1 text-xs text-slate-500">Tramos en bolivianos por mes; porcentajes dentro de cada sector.</p>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel
                titulo="Rubro de la organización"
                interpretacion={rubroMayor ? `${rubroMayor.categoria} concentra el ${pct(rubroMayor.porcentaje)} del empleo en organizaciones.` : undefined}
                fuente={`titulados que trabajan en una organización, n = ${m.rubros.total}`}
              >
                <BarrasHorizontales datos={barras(m.rubros)} anchoEtiquetas={170} />
              </Panel>
              <Panel
                titulo="Cargo desempeñado"
                interpretacion={cargoMayor ? `El ${pct(cargoMayor.porcentaje)} trabaja en ${cargoMayor.categoria.toLowerCase()}.` : undefined}
                fuente={`titulados que trabajan en una organización, n = ${m.cargos.total}`}
              >
                <BarrasHorizontales datos={barras(m.cargos)} anchoEtiquetas={110} />
              </Panel>
            </div>
          </Seccion>

          <Seccion titulo="Titulados sin empleo y emprendedores">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel
                titulo="Razones por las que no trabaja"
                interpretacion={razonMayor ? `La razón más citada: ${razonCorta(razonMayor.categoria).toLowerCase()} (${pct(razonMayor.porcentaje)}).` : undefined}
                fuente={`titulados que no trabajan, n = ${m.razonesNoTrabaja.total}`}
              >
                <BarrasHorizontales
                  datos={barras(m.razonesNoTrabaja).map((d) => ({ ...d, categoria: razonCorta(d.categoria) }))}
                  anchoEtiquetas={230}
                />
              </Panel>
              <Panel
                titulo="Emprendedores"
                interpretacion={`El ${pct((100 * importante) / (emp.importancia.total || 1))} considera importante la formación recibida para su negocio.`}
                fuente={`titulados con emprendimiento propio, n = ${emp.total}`}
              >
                <dl className="space-y-3">
                  {[
                    { termino: 'Idea propia o con compañeros', valor: pct((100 * idea) / (emp.origen.total || 1)), detalle: `${idea} de ${emp.origen.total}` },
                    { termino: 'Financiado con recursos propios', valor: pct(propio?.porcentaje), detalle: `${propio?.n ?? 0} de ${emp.financiamiento.total}` },
                    { termino: 'Satisfecho con su negocio', valor: pct(satisfecho?.porcentaje), detalle: `${satisfecho?.n ?? 0} de ${emp.satisfaccion.total}` }
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
        </>
      )}

      {vista === 'empleadores' && (
        <>
          <Seccion titulo="Perfil de las organizaciones">
            <FilaKpi>
              <Kpi
                valor={pct(buscar(e.tipos, 'Privado')?.porcentaje)}
                etiqueta="Sector privado"
                contexto={`${buscar(e.tipos, 'Privado')?.n ?? 0} de ${e.tipos.total} organizaciones`}
              />
              <Kpi valor={pct(e.contrato5.porcentaje)} etiqueta="Contrató en los últimos 5 años" contexto={`${e.contrato5.n} de ${e.contrato5.total}`} />
              <Kpi
                valor={pct(e.prevenContratar.porcentaje)}
                etiqueta="Prevé contratar"
                contexto="con alta probabilidad o según sus proyectos"
              />
              <Kpi valor={pct(licenciatura?.porcentaje)} etiqueta="Exige licenciatura" contexto={`${licenciatura?.n ?? 0} de ${e.niveles.total}`} />
            </FilaKpi>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel
                titulo="Rubro"
                interpretacion={rubroEmpleador ? `${rubroEmpleador.categoria} reúne al ${pct(rubroEmpleador.porcentaje)} de las organizaciones.` : undefined}
                fuente={fuenteEmpleadores}
              >
                <BarrasHorizontales datos={barras(e.rubros)} anchoEtiquetas={250} />
              </Panel>
              <div className="grid grid-cols-1 gap-4">
                <Panel
                  titulo="Tamaño"
                  interpretacion={tamanoMayor ? `El grupo más numeroso es el de empresas de tamaño ${tamanoMayor.categoria.toLowerCase()} (${pct(tamanoMayor.porcentaje)}).` : undefined}
                  fuente={fuenteEmpleadores}
                >
                  <BarrasHorizontales datos={barras(e.tamanos, false)} anchoEtiquetas={80} />
                </Panel>
                <Panel
                  titulo="Previsión de contratación"
                  interpretacion={noPrevista ? `El ${pct(noPrevista.porcentaje)} no prevé contratar por ahora.` : undefined}
                  fuente={fuenteEmpleadores}
                >
                  <BarrasHorizontales datos={barras(e.posibilidad, false)} anchoEtiquetas={230} />
                </Panel>
              </div>
            </div>
          </Seccion>

          <Seccion titulo="Requisitos de contratación">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Panel
                titulo="Nivel de formación exigido"
                interpretacion={`Solo el ${pct(100 - (licenciatura?.porcentaje ?? 0))} pide un posgrado o diplomado.`}
                fuente={fuenteEmpleadores}
              >
                <BarrasHorizontales datos={barras(e.niveles, false)} anchoEtiquetas={100} />
              </Panel>
              <Panel
                titulo="Cargos que ocupan los titulados"
                interpretacion={cargoEmpleador ? `El cargo más frecuente es ${cargoEmpleador.categoria.toLowerCase()} (${pct(cargoEmpleador.porcentaje)}).` : undefined}
                fuente={`${fuenteEmpleadores}; selección múltiple`}
              >
                <BarrasHorizontales datos={barras(e.cargos)} anchoEtiquetas={180} />
              </Panel>
              <Panel
                titulo="Medio de convocatoria"
                interpretacion={medioMayor ? `${medioMayor.categoria} es el medio más usado (${pct(medioMayor.porcentaje)}).` : undefined}
                fuente={fuenteEmpleadores}
              >
                <BarrasHorizontales datos={barras(e.medios)} anchoEtiquetas={170} />
              </Panel>
            </div>
          </Seccion>

          <Seccion
            titulo="Tecnologías y habilidades demandadas"
            descripcion="Preguntas abiertas clasificadas por palabras clave; una respuesta puede mencionar varios temas."
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel
                titulo="Tecnologías que demandan los empleadores"
                interpretacion={
                  masDeMitad.length === 1
                    ? `${masDeMitad[0].categoria} es la única tecnología mencionada por más de la mitad de los empleadores.`
                    : masDeMitad.length > 1
                      ? `${unirLista(masDeMitad.map((t) => t.categoria))} son mencionadas por más de la mitad de los empleadores.`
                      : 'Ninguna tecnología es mencionada por más de la mitad de los empleadores.'
                }
                fuente={`${fuenteEmpleadores}; ${e.tecnologias.validas} respuestas válidas, % de menciones`}
              >
                <Radar puntos={e.tecnologias.temas.map((t) => ({ eje: t.categoria, valor: t.porcentaje }))} sufijo="%" />
              </Panel>
              <Panel
                titulo="Habilidades más valoradas"
                interpretacion={
                  habilidades[0] && habilidades[1]
                    ? `Las más pedidas son ${unirDos(habilidades[0].categoria.toLowerCase(), habilidades[1].categoria.toLowerCase())}.`
                    : undefined
                }
                fuente={`${fuenteEmpleadores}; ${e.habilidades.validas} respuestas válidas`}
              >
                <BarrasHorizontales datos={habilidades.filter((h) => h.n > 0)} anchoEtiquetas={270} />
              </Panel>
            </div>
          </Seccion>
        </>
      )}
    </div>
  );
};
