/**
 * Clasificación de respuestas abiertas por temas mediante palabras clave.
 *
 * Una respuesta puede pertenecer a varios temas. El porcentaje de cada tema se calcula sobre
 * las respuestas válidas (no vacías y que no declaran desconocer el tema).
 */

/** Minúsculas, sin tildes y con espacios simples (conserva signos como "c++" o "c#"). */
export function normalizarRespuesta(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Tema {
  nombre: string;
  /** Expresión regular sobre el texto normalizado. */
  patron: RegExp;
  /** Menciones que contienen el término pero no expresan esa demanda. */
  excluir?: RegExp;
}

export interface ResultadoTema {
  categoria: string;
  n: number;
  porcentaje: number;
}

export interface ClasificacionTemas {
  /** Respuestas consideradas en el denominador. */
  validas: number;
  temas: ResultadoTema[];
}

/** Respuestas que no aportan contenido (el empleador declara no conocer el área). */
const RESPUESTA_NO_VALIDA = /no tenemos conocimiento|desconocemos/;

export function clasificarRespuestas(respuestas: Array<string | undefined>, temas: Tema[]): ClasificacionTemas {
  const validas = respuestas
    .map((r) => normalizarRespuesta(r ?? ''))
    .filter((r) => r !== '' && !RESPUESTA_NO_VALIDA.test(r));
  return {
    validas: validas.length,
    temas: temas.map((tema) => {
      const n = validas.filter((r) => tema.patron.test(r) && !(tema.excluir?.test(r) ?? false)).length;
      return { categoria: tema.nombre, n, porcentaje: validas.length > 0 ? (100 * n) / validas.length : 0 };
    })
  };
}

/** Temas de la pregunta "tecnologías y tendencias indispensables" (Figura 15 del informe). */
export const TEMAS_TECNOLOGIA: Tema[] = [
  {
    nombre: 'IA',
    patron: /\bia\b|\bai\b|inteligen\w* artific|machine learning|maching learning|\bml\b|agente|agentic|prompt|claude|codex|antigravity|mlops|generativ/,
    // "Competir con la IA" la presenta como competencia, no como tecnología que se demanda
    excluir: /competir con la ia/
  },
  {
    nombre: 'Web y móvil',
    patron:
      /\bweb\b|movil|moviles|\bapps?\b|\bapis?\b|frontend|backend|\bnext\b|flutter|arquitectura de software|framework|postman|kotlin|\bjava\b|c\+\+|\brust\b|diferentes lenguajes/
  },
  { nombre: 'Ciberseguridad', patron: /ciber|seguridad|forens/ },
  { nombre: 'Automatización e IoT', patron: /automatiz|\biot\b|industrial|digital twins/ },
  { nombre: 'Nube y DevOps', patron: /nube|cloud|\baws\b|devops|contenedor|docker|kubernetes/ },
  { nombre: 'Datos', patron: /datos|\bdata\b|\bsql\b|big data/ },
  { nombre: 'Gestión ágil', patron: /agil|scrum|jira|trello|product owner|\bbpm\b|negocio|mejoramiento/ },
  { nombre: 'Git', patron: /\bgit\b|github|\bgti\b/ }
];

/** Temas de la pregunta "habilidades más valoradas" (Figura 16 del informe). */
export const TEMAS_HABILIDADES: Tema[] = [
  {
    nombre: 'Adaptabilidad y aprendizaje continuo',
    patron: /adapta|aprendizaje|aprender|actualiza|formacion continua|versatil|investigacion de nuevas/
  },
  { nombre: 'Trabajo en equipo', patron: /equipo|colaboracion/ },
  { nombre: 'Resolución de problemas y pensamiento lógico', patron: /problema|pensamiento|logic|analitic|abstraccion|diagnostico/ },
  { nombre: 'Comunicación', patron: /comunicacion|expresion|relaciones personales|interpersonal/ },
  { nombre: 'Responsabilidad y ética', patron: /responsab|etica|compromiso|confiab|seriedad|disciplina|dedicacion|respeto|rigurosidad|constancia/ },
  { nombre: 'Comprensión del negocio y los requerimientos', patron: /negocio|requerimiento|necesidades|gestion/ },
  { nombre: 'Trabajo bajo presión', patron: /presion|multitask/ },
  { nombre: 'Proactividad e iniciativa', patron: /proactiv|iniciativa/ },
  { nombre: 'Inglés', patron: /ingles/ }
];
