/**
 * Hallazgos, fortalezas, oportunidades e indicadores del plan de acción, generados con los
 * valores calculados de la base. Las implicancias y acciones son las propuestas del informe.
 */

import type { Empleador, Titulado } from '../types';
import {
  analizarAspectosFormacion,
  analizarDemandaPosgrado,
  analizarEmpleadores,
  analizarMercadoTitulados,
  analizarValoracionTitulados,
  analizarVidaProfesional,
  codigoItem,
  indicePorItem,
  indicesPorDimension,
  tablaSectorRemuneracion
} from './analisis';
import { pruebaIndependencia } from './estadistica';
import { num, pct, porcentaje, unirDos, unirLista } from './formato';

export interface Hallazgo {
  numero: number;
  hallazgo: string;
  evidencia: string;
  implicancia: string;
}

/** Todos los valores que usan la portada, el plan estratégico y el informe. */
export function calcularResumen(titulados: Titulado[], empleadores: Empleador[]) {
  const mercado = analizarMercadoTitulados(titulados);
  const posgrado = analizarDemandaPosgrado(titulados);
  const valoracion = analizarValoracionTitulados(titulados);
  const aspectos = analizarAspectosFormacion(titulados);
  const vida = analizarVidaProfesional(titulados);
  const emp = analizarEmpleadores(empleadores);
  const dimensiones = indicesPorDimension(empleadores);
  const sectorRemuneracion = pruebaIndependencia(tablaSectorRemuneracion(titulados));

  const item = (campo: string) => valoracion.find((v) => v.campo === campo)?.estadisticos;
  const concordancia = item('concordancia_formacion');
  const desacuerdoConcordancia = concordancia
    ? porcentaje(concordancia.distribucion[0] + concordancia.distribucion[1], concordancia.n)
    : 0;
  const ordenar = <T extends { n: number }>(filas: T[]) => [...filas].sort((a, b) => b.n - a.n);

  // Afirmación 18: consulta periódica durante la autoevaluación (sobre todos los empleadores)
  const consulta = indicePorItem(empleadores, codigoItem(18));
  const consultados = porcentaje(consulta.totalmenteDeAcuerdo + consulta.parcialmenteDeAcuerdo, empleadores.length);
  const nuncaConsultados = porcentaje(consulta.totalmenteEnDesacuerdo, empleadores.length);
  // Afirmación 1: confianza (acuerdo total o parcial sobre quienes respondieron)
  const confianza = indicePorItem(empleadores, codigoItem(1));
  const confianzaPct = porcentaje(
    confianza.totalmenteDeAcuerdo + confianza.parcialmenteDeAcuerdo,
    confianza.nValidas + confianza.noSabe
  );

  return {
    mercado,
    posgrado,
    valoracion,
    aspectos,
    vida,
    emp,
    dimensiones,
    sectorRemuneracion,
    concordancia,
    desacuerdoConcordancia,
    consultados,
    nuncaConsultados,
    confianzaPct,
    ordenar
  };
}

export type Resumen = ReturnType<typeof calcularResumen>;

const buscar = <T extends { categoria: string }>(filas: T[], categoria: string) => filas.find((f) => f.categoria === categoria);

/** Matriz de los 10 hallazgos principales (Tabla 11 del informe). */
export function generarHallazgos(r: Resumen): Hallazgo[] {
  const { mercado, posgrado, valoracion, aspectos, emp } = r;
  const pertinencia = valoracion.find((v) => v.campo === 'pertinencia_labores')?.estadisticos;
  const privado = buscar(mercado.sectorEnOrganizacion.filas, 'Privado');
  const software = buscar(mercado.rubros.filas, 'Desarrollo de Software');
  const propios = buscar(posgrado.financiamientos.filas, 'Recursos propios');
  const ia = buscar(emp.tecnologias.temas, 'IA');
  const actualizar = buscar(aspectos.mejorar.filas, 'Actualización constante del plan');
  const noUtiles = r.ordenar(aspectos.asignaturasNoUtiles.filas).slice(0, 3);
  const sr = r.sectorRemuneracion;
  const [area1, area2] = r.ordenar(posgrado.areas.filas);

  return [
    {
      numero: 1,
      hallazgo: 'Alta empleabilidad e inserción temprana',
      evidencia: `${pct(mercado.ocupacion.porcentaje)} trabaja o emprende; ${pct(mercado.yaTrabajaba.porcentaje)} ya trabajaba antes de titularse`,
      implicancia: 'Fortaleza clave para el criterio de pertinencia ARCU-SUR'
    },
    {
      numero: 2,
      hallazgo: 'Labores pertinentes a la formación',
      evidencia: `${pct(pertinencia?.porcentajeAcuerdo)} de acuerdo con la pertinencia de sus labores`,
      implicancia: 'Evidencia directa de pertinencia del perfil profesional'
    },
    {
      numero: 3,
      hallazgo: 'Mercado privado y de desarrollo de software',
      evidencia: `${pct(privado?.porcentaje)} en el sector privado; ${pct(software?.porcentaje)} en desarrollo de software`,
      implicancia: 'Reforzar la ingeniería de software moderna en la malla curricular'
    },
    {
      numero: 4,
      hallazgo: sr?.rechazaH0 ? 'El sector privado paga más' : 'La remuneración no difiere según el sector',
      evidencia: sr
        ? `Yates χ² = ${num(sr.estadisticoOficial, 3)}, p = ${num(sr.pValorOficial, 4)}, V = ${num(sr.vCramer, 2)}`
        : 'Sin datos suficientes',
      implicancia: 'Orientar la vinculación estratégica hacia empresas de software exportadoras'
    },
    {
      numero: 5,
      hallazgo: `Alta demanda de posgrado en ${area1?.categoria ?? 'IA'}`,
      evidencia: `${pct(posgrado.interesados.porcentaje)} interesados; ${unirDos(area1?.categoria ?? '', area2?.categoria ?? '')} suman ${pct(posgrado.concentracionAreas.porcentaje)} de las preferencias`,
      implicancia: 'Priorizar programas modulares en IA e Ingeniería de Software en la FCyT'
    },
    {
      numero: 6,
      hallazgo: 'Los empleadores piden IA',
      evidencia: `${pct(ia?.porcentaje)} menciona la IA como tecnología clave`,
      implicancia: 'Incorporar la IA de forma transversal y aplicada en el plan de estudios'
    },
    {
      numero: 7,
      hallazgo: 'Financiamiento casi totalmente personal',
      evidencia: `${pct(propios?.porcentaje)} pagó su posgrado con recursos propios`,
      implicancia: 'Gestionar convenios con la banca y becas con empresas'
    },
    {
      numero: 8,
      hallazgo: 'Brecha entre formación y requerimientos laborales',
      evidencia: `${pct(r.desacuerdoConcordancia)} en desacuerdo con la concordancia; ${pct(actualizar?.porcentaje)} pide actualizar el plan`,
      implicancia: 'Actualización curricular periódica alineada al mercado tecnológico'
    },
    {
      numero: 9,
      hallazgo: 'Débil vinculación con empleadores',
      evidencia: `${pct(r.nuncaConsultados)} nunca fue consultado en la autoevaluación`,
      implicancia: 'Institucionalizar la consulta sistemática mediante un consejo consultivo'
    },
    {
      numero: 10,
      hallazgo: 'Asignaturas de baja utilidad percibida',
      evidencia: unirLista(noUtiles.map((f) => `${f.categoria} ${pct(f.porcentaje)}`)),
      implicancia: 'Revisar la vigencia de esas materias y sustituirlas por tecnologías vigentes'
    }
  ];
}

/** Fortalezas y oportunidades de mejora (Tabla 12 del informe). */
export function generarFortalezasOportunidades(r: Resumen) {
  const { mercado, posgrado, valoracion, aspectos } = r;
  const pertinencia = valoracion.find((v) => v.campo === 'pertinencia_labores')?.estadisticos;
  const analiticas = buscar(aspectos.utiles.filas, 'Habilidades analíticas y resolución de problemas');
  const ventaja = r.ordenar(aspectos.asignaturasVentaja.filas).slice(0, 3);
  const fcyt = buscar(posgrado.instituciones.filas, 'Posgrado FCyT');
  const internacional = buscar(posgrado.instituciones.filas, 'Univ. internacionales');
  const actualizar = buscar(aspectos.mejorar.filas, 'Actualización constante del plan');
  const pasantias = buscar(aspectos.utiles.filas, 'Pasantías o prácticas profesionales');
  const confianza = r.dimensiones[0];

  return {
    fortalezas: [
      `Inserción antes de titularse: ${pct(mercado.yaTrabajaba.porcentaje)} ya trabajaba`,
      `Labores pertinentes a la formación: ${pct(pertinencia?.porcentajeAcuerdo)} de acuerdo`,
      `Habilidades analíticas y de resolución de problemas valoradas por el ${pct(analiticas?.porcentaje)}`,
      `Asignaturas aplicadas bien valoradas: ${unirLista(ventaja.map((f) => `${f.categoria} ${pct(f.porcentaje)}`))}`,
      `Confianza de los empleadores en la Carrera: índice ${num(confianza?.indice, 1)}, ${pct(r.confianzaPct)} de acuerdo`,
      `El Posgrado FCyT es la primera opción de posgrado (${pct(fcyt?.porcentaje)})`
    ],
    oportunidades: [
      `Mejorar la concordancia de la formación con el mercado (${pct(r.desacuerdoConcordancia)} en desacuerdo)`,
      `Actualizar el plan de estudios hacia IA, nube, DevOps y microservicios (${pct(actualizar?.porcentaje)} lo pide)`,
      `Ampliar las pasantías con empresas de software (solo ${pct(pasantias?.porcentaje)} las valora hoy)`,
      'Reforzar inglés técnico, ciberseguridad y comunicación',
      `Consultar sistemáticamente a los empleadores en la autoevaluación (hoy ${pct(r.consultados)})`,
      `Crear becas para competir con la oferta internacional (${pct(internacional?.porcentaje)} la prefiere)`
    ]
  };
}

export interface AccionPlan {
  linea: string;
  accion: string;
  indicador: string;
  plazo: string;
}

/** Plan de acción (Tabla 13 del informe) con la línea base calculada. */
export function generarPlanAccion(r: Resumen): AccionPlan[] {
  return [
    {
      linea: '1. Becas y financiamiento',
      accion: 'Convenios con la banca para créditos educativos y con empresas de software para becas parciales',
      indicador: `% de estudiantes de posgrado con beca o crédito (hoy ${pct(r.posgrado.conBeca.porcentaje)}; meta: 30%)`,
      plazo: 'Corto plazo (1 año)'
    },
    {
      linea: '2. Posgrados modulares',
      accion: 'Diplomados en IA, Ingeniería de Software y Redes acumulables hacia una maestría; Base de Datos y Robótica como módulos',
      indicador: 'Inscritos por programa frente al mínimo de equilibrio (15 inscritos)',
      plazo: 'Mediano plazo (1 a 2 años)'
    },
    {
      linea: '3. Vinculación con empleadores',
      accion: 'Consejo consultivo de empleadores y convenios de pasantías con empresas de Cochabamba y del país',
      indicador: `% de empleadores consultados periódicamente (hoy ${pct(r.consultados)}; meta: más de 70%) e inserción en 4 meses o menos (hoy ${pct(r.mercado.insercionRapida.porcentaje)})`,
      plazo: 'Corto plazo (1 año)'
    },
    {
      linea: '4. Actualización curricular',
      accion: 'Incorporar de forma transversal IA, computación en la nube, ciberseguridad e inglés técnico',
      indicador: `% de titulados que percibe concordancia con el mercado (hoy ${pct(r.concordancia?.porcentajeAcuerdo)}; meta: más de 80%)`,
      plazo: 'Mediano plazo (2 años)'
    },
    {
      linea: '5. Observatorio permanente',
      accion: 'Aplicar las encuestas cada gestión, actualizar la base y recalibrar los escenarios de simulación',
      indicador: 'Titulados (150 o más por año) y empleadores (50 o más por año) registrados',
      plazo: 'Permanente'
    }
  ];
}
