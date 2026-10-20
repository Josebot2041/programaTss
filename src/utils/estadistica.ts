/**
 * Funciones estadísticas puras (sin dependencia de la interfaz ni del modelo de datos).
 * Marco metodológico del Taller de Simulación de Sistemas (UMSS).
 *
 * Los resultados no se redondean aquí: el redondeo es solo de presentación (ver `redondear`).
 */

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Redondeo para mostrar (evita errores de coma flotante como 1.005 → 1.00). */
export function redondear(valor: number, decimales = 2): number {
  const factor = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * factor) / factor;
}

const sumar = (valores: number[]) => valores.reduce((acc, v) => acc + v, 0);

// ---------------------------------------------------------------------------
// Funciones especiales: gamma, gamma incompleta y distribución chi-cuadrado
// ---------------------------------------------------------------------------

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
];

/** Logaritmo natural de la función gamma (aproximación de Lanczos, g = 7). */
export function lnGamma(x: number): number {
  if (x < 0.5) {
    // Fórmula de reflexión
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  }
  const z = x - 1;
  let a = LANCZOS[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Función gamma incompleta regularizada inferior P(a, x). */
export function gammaRegularizadaInferior(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    // Desarrollo en serie
    let termino = 1 / a;
    let suma = termino;
    for (let n = 1; n < 1000; n++) {
      termino *= x / (a + n);
      suma += termino;
      if (Math.abs(termino) < Math.abs(suma) * 1e-15) break;
    }
    return suma * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
  return 1 - gammaRegularizadaSuperior(a, x);
}

/** Función gamma incompleta regularizada superior Q(a, x) = 1 − P(a, x). */
export function gammaRegularizadaSuperior(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x < a + 1) return 1 - gammaRegularizadaInferior(a, x);
  // Fracción continua de Lentz
  const MINIMO = 1e-300;
  let b = x + 1 - a;
  let c = 1 / MINIMO;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < MINIMO) d = MINIMO;
    c = b + an / c;
    if (Math.abs(c) < MINIMO) c = MINIMO;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** P(X ≥ x) para X ~ χ²(gl): el p-valor de una prueba chi-cuadrado. */
export function chiCuadradoPValor(x: number, gl: number): number {
  return gammaRegularizadaSuperior(gl / 2, x / 2);
}

/** Valor crítico χ²(1 − α; gl): el x tal que P(X ≥ x) = α. */
export function chiCuadradoCritico(alfa: number, gl: number): number {
  let bajo = 0;
  let alto = Math.max(1, gl);
  while (chiCuadradoPValor(alto, gl) > alfa) alto *= 2;
  for (let i = 0; i < 200; i++) {
    const medio = (bajo + alto) / 2;
    if (chiCuadradoPValor(medio, gl) > alfa) bajo = medio;
    else alto = medio;
  }
  return (bajo + alto) / 2;
}

// ---------------------------------------------------------------------------
// Distribución t de Student
// ---------------------------------------------------------------------------

/** Función beta incompleta regularizada I_x(a, b) (fracción continua de Lentz). */
export function betaIncompletaRegularizada(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnFrente = lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  // La fracción converge rápido para x < (a + 1) / (a + b + 2); si no, se usa la simetría
  if (x > (a + 1) / (a + b + 2)) return 1 - betaIncompletaRegularizada(1 - x, b, a);
  const MINIMO = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < MINIMO) d = MINIMO;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < 1000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < MINIMO) d = MINIMO;
    c = 1 + aa / c;
    if (Math.abs(c) < MINIMO) c = MINIMO;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < MINIMO) d = MINIMO;
    c = 1 + aa / c;
    if (Math.abs(c) < MINIMO) c = MINIMO;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return (Math.exp(lnFrente) * h) / a;
}

/** p-valor bilateral de un estadístico t con `gl` grados de libertad. */
export function tPValorBilateral(t: number, gl: number): number {
  return betaIncompletaRegularizada(gl / (gl + t * t), gl / 2, 0.5);
}

/** Valor crítico t(1 − α/2; gl) para un intervalo o prueba bilateral. */
export function tCritico(alfa: number, gl: number): number {
  let bajo = 0;
  let alto = 1;
  while (tPValorBilateral(alto, gl) > alfa) alto *= 2;
  for (let i = 0; i < 200; i++) {
    const medio = (bajo + alto) / 2;
    if (tPValorBilateral(medio, gl) > alfa) bajo = medio;
    else alto = medio;
  }
  return (bajo + alto) / 2;
}

export interface IntervaloConfianza {
  n: number;
  media: number;
  desviacion: number;
  /** Semiamplitud: t · s / √n. */
  margen: number;
  inferior: number;
  superior: number;
  nivel: number;
  tCritico: number;
}

/** Intervalo de confianza para la media con la distribución t de Student (n − 1 gl). */
export function intervaloConfianzaT(valores: number[], nivel = 0.95): IntervaloConfianza | null {
  const d = descriptivos(valores);
  if (!d || d.n < 2) return null;
  const t = tCritico(1 - nivel, d.n - 1);
  const margen = (t * d.desviacion) / Math.sqrt(d.n);
  return { n: d.n, media: d.media, desviacion: d.desviacion, margen, inferior: d.media - margen, superior: d.media + margen, nivel, tCritico: t };
}

export interface ResultadoWelch {
  /** Media de b menos media de a. */
  diferencia: number;
  t: number;
  gl: number;
  pValor: number;
  /** Intervalo de confianza de la diferencia. */
  inferior: number;
  superior: number;
}

/** Prueba t de Welch para dos muestras independientes (varianzas no supuestas iguales). */
export function pruebaTWelch(a: number[], b: number[], nivel = 0.95): ResultadoWelch | null {
  const da = descriptivos(a);
  const db = descriptivos(b);
  if (!da || !db || da.n < 2 || db.n < 2) return null;
  const va = da.varianza / da.n;
  const vb = db.varianza / db.n;
  const error = Math.sqrt(va + vb);
  const diferencia = db.media - da.media;
  if (error === 0) return { diferencia, t: Infinity, gl: da.n + db.n - 2, pValor: diferencia === 0 ? 1 : 0, inferior: diferencia, superior: diferencia };
  const gl = (va + vb) ** 2 / (va ** 2 / (da.n - 1) + vb ** 2 / (db.n - 1));
  const t = diferencia / error;
  const margen = tCritico(1 - nivel, gl) * error;
  return { diferencia, t, gl, pValor: tPValorBilateral(t, gl), inferior: diferencia - margen, superior: diferencia + margen };
}

// ---------------------------------------------------------------------------
// Pruebas sobre números pseudoaleatorios
// ---------------------------------------------------------------------------

export interface ResultadoCorridas {
  corridas: number;
  esperadas: number;
  varianza: number;
  z: number;
  /** |z| < 1.96: no se rechaza la independencia con α = 0.05. */
  independiente: boolean;
}

/** Prueba de corridas arriba y abajo de la media (independencia de una secuencia). */
export function pruebaCorridas(u: number[]): ResultadoCorridas {
  const n = u.length;
  let corridas = n > 1 ? 1 : 0;
  for (let i = 2; i < n; i++) {
    if (Math.sign(u[i] - u[i - 1]) !== Math.sign(u[i - 1] - u[i - 2])) corridas++;
  }
  const esperadas = (2 * n - 1) / 3;
  const varianza = (16 * n - 29) / 90;
  const z = (corridas - esperadas) / Math.sqrt(varianza);
  return { corridas, esperadas, varianza, z, independiente: Math.abs(z) < 1.96 };
}

export interface ResultadoBondadAjuste {
  estadistico: number;
  gl: number;
  pValor: number;
  valorCritico: number;
  ajusta: boolean;
}

/** Bondad de ajuste chi-cuadrado de frecuencias observadas frente a probabilidades teóricas. */
export function bondadAjuste(observadas: number[], probabilidades: number[], alfa = 0.05): ResultadoBondadAjuste {
  const n = observadas.reduce((s, v) => s + v, 0);
  let estadistico = 0;
  observadas.forEach((o, i) => {
    const e = n * probabilidades[i];
    if (e > 0) estadistico += (o - e) ** 2 / e;
  });
  const gl = observadas.filter((_, i) => probabilidades[i] > 0).length - 1;
  const pValor = chiCuadradoPValor(estadistico, gl);
  return { estadistico, gl, pValor, valorCritico: chiCuadradoCritico(alfa, gl), ajusta: pValor >= alfa };
}

// ---------------------------------------------------------------------------
// Estadística descriptiva
// ---------------------------------------------------------------------------

export interface Descriptivos {
  n: number;
  media: number;
  mediana: number;
  /** Desviación estándar muestral (divisor n − 1). */
  desviacion: number;
  varianza: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
  rango: number;
}

/** Percentil con interpolación lineal sobre (n − 1), igual que CUARTIL.INC / PERCENTIL.INC de Excel. */
export function percentil(ordenados: number[], p: number): number {
  if (ordenados.length === 0) return NaN;
  const h = (ordenados.length - 1) * p;
  const i = Math.floor(h);
  const siguiente = ordenados[Math.min(i + 1, ordenados.length - 1)];
  return ordenados[i] + (h - i) * (siguiente - ordenados[i]);
}

/** Descriptivos de una muestra; devuelve null si no hay datos. */
export function descriptivos(valores: number[]): Descriptivos | null {
  const n = valores.length;
  if (n === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const media = sumar(ordenados) / n;
  const varianza = n > 1 ? sumar(ordenados.map((v) => (v - media) ** 2)) / (n - 1) : 0;
  return {
    n,
    media,
    mediana: percentil(ordenados, 0.5),
    desviacion: Math.sqrt(varianza),
    varianza,
    q1: percentil(ordenados, 0.25),
    q3: percentil(ordenados, 0.75),
    min: ordenados[0],
    max: ordenados[n - 1],
    rango: ordenados[n - 1] - ordenados[0]
  };
}

export interface Intervalo {
  /** Límite inferior (incluido). */
  desde: number;
  /** Límite superior (excluido). */
  hasta: number;
  n: number;
}

/** Histograma con intervalos de igual ancho [desde, hasta), desde `inicio` hasta cubrir el máximo. */
export function histograma(valores: number[], ancho: number, inicio = 0): Intervalo[] {
  if (valores.length === 0) return [];
  const maximo = Math.max(...valores);
  const cantidad = Math.floor((maximo - inicio) / ancho) + 1;
  const intervalos = Array.from({ length: cantidad }, (_, k) => ({
    desde: inicio + k * ancho,
    hasta: inicio + (k + 1) * ancho,
    n: 0
  }));
  for (const v of valores) {
    const k = Math.floor((v - inicio) / ancho);
    if (k >= 0 && k < cantidad) intervalos[k].n++;
  }
  return intervalos;
}

// ---------------------------------------------------------------------------
// Frecuencias
// ---------------------------------------------------------------------------

export interface Frecuencia<T extends string = string> {
  categoria: T;
  n: number;
  /** Porcentaje sobre el total de respuestas válidas (0–100). */
  porcentaje: number;
}

export interface TablaFrecuencias<T extends string = string> {
  /** Respuestas válidas (sin contar vacíos). */
  total: number;
  filas: Frecuencia<T>[];
}

/**
 * Frecuencias absolutas y relativas. Los valores vacíos (undefined) no cuentan.
 * Con `orden` se listan todas las categorías del catálogo en ese orden, incluidas las de n = 0;
 * sin `orden`, de mayor a menor frecuencia.
 */
export function frecuencias<T extends string>(valores: Array<T | undefined>, orden?: readonly T[]): TablaFrecuencias<T> {
  const conteo = new Map<T, number>();
  for (const v of valores) if (v !== undefined) conteo.set(v, (conteo.get(v) ?? 0) + 1);
  const total = sumar([...conteo.values()]);
  const categorias = orden
    ? [...orden, ...[...conteo.keys()].filter((c) => !orden.includes(c))]
    : [...conteo.keys()].sort((a, b) => (conteo.get(b) ?? 0) - (conteo.get(a) ?? 0));
  return {
    total,
    filas: categorias.map((categoria) => {
      const n = conteo.get(categoria) ?? 0;
      return { categoria, n, porcentaje: total > 0 ? (100 * n) / total : 0 };
    })
  };
}

/**
 * Frecuencias de una pregunta de selección múltiple. El porcentaje se calcula sobre `base`
 * (número de encuestados), por lo que la suma puede superar el 100 %.
 */
export function frecuenciasMultiples<T extends string>(listas: T[][], base: number, orden?: readonly T[]): TablaFrecuencias<T> {
  const conteo = frecuencias(listas.flat(), orden);
  return {
    total: base,
    filas: conteo.filas.map((f) => ({ ...f, porcentaje: base > 0 ? (100 * f.n) / base : 0 }))
  };
}

export interface Concentracion<T extends string = string> {
  categorias: T[];
  n: number;
  porcentaje: number;
}

/** Suma de las k categorías más frecuentes (por ejemplo, las 2 áreas principales de HU2). */
export function concentracionPrincipales<T extends string>(tabla: TablaFrecuencias<T>, k = 2): Concentracion<T> {
  const principales = [...tabla.filas].sort((a, b) => b.n - a.n).slice(0, k);
  const n = sumar(principales.map((f) => f.n));
  return {
    categorias: principales.map((f) => f.categoria),
    n,
    porcentaje: tabla.total > 0 ? (100 * n) / tabla.total : 0
  };
}

export type NivelAlerta = 'alerta' | 'cerca' | 'normal';

/**
 * Regla de alerta de concentración (HU2): "alerta" si supera el umbral; "cerca" si está a
 * menos de `margen` puntos porcentuales por debajo; "normal" en otro caso.
 */
export function evaluarConcentracion(porcentaje: number, umbral = 70, margen = 5): NivelAlerta {
  if (porcentaje > umbral) return 'alerta';
  if (porcentaje > umbral - margen) return 'cerca';
  return 'normal';
}

// ---------------------------------------------------------------------------
// Tablas cruzadas y pruebas de independencia
// ---------------------------------------------------------------------------

export interface TablaCruzada {
  filas: string[];
  columnas: string[];
  observadas: number[][];
  totalesFila: number[];
  totalesColumna: number[];
  total: number;
}

/** Arma una tabla cruzada a partir de una matriz de frecuencias observadas. */
export function crearTablaCruzada(filas: string[], columnas: string[], observadas: number[][]): TablaCruzada {
  const totalesFila = observadas.map(sumar);
  const totalesColumna = columnas.map((_, j) => sumar(observadas.map((fila) => fila[j] ?? 0)));
  return { filas, columnas, observadas, totalesFila, totalesColumna, total: sumar(totalesFila) };
}

/**
 * Tabla cruzada de dos variables categóricas. Se omiten los registros con alguna de las dos
 * variables vacía y, si `omitirVacias`, las filas/columnas con total cero.
 */
export function tablaCruzada<R, F extends string, C extends string>(
  registros: R[],
  variableFila: (r: R) => F | undefined,
  variableColumna: (r: R) => C | undefined,
  ordenFilas: readonly F[],
  ordenColumnas: readonly C[],
  omitirVacias = true
): TablaCruzada {
  const observadas = ordenFilas.map(() => ordenColumnas.map(() => 0));
  for (const r of registros) {
    const i = ordenFilas.indexOf(variableFila(r) as F);
    const j = ordenColumnas.indexOf(variableColumna(r) as C);
    if (i !== -1 && j !== -1) observadas[i][j]++;
  }
  let filas = [...ordenFilas] as string[];
  let columnas = [...ordenColumnas] as string[];
  let matriz = observadas;
  if (omitirVacias) {
    const filasConDatos = matriz.map((f) => sumar(f) > 0);
    const columnasConDatos = columnas.map((_, j) => matriz.some((f) => f[j] > 0));
    filas = filas.filter((_, i) => filasConDatos[i]);
    columnas = columnas.filter((_, j) => columnasConDatos[j]);
    matriz = matriz.filter((_, i) => filasConDatos[i]).map((f) => f.filter((_, j) => columnasConDatos[j]));
  }
  return crearTablaCruzada(filas, columnas, matriz);
}

export interface ResultadoChiCuadrado {
  estadistico: number;
  gl: number;
  pValor: number;
  alfa: number;
  valorCritico: number;
  rechazaH0: boolean;
  correccionYates: boolean;
  esperadas: number[][];
  /** Celdas con frecuencia esperada menor que 5. */
  celdasEsperadaMenor5: number;
  totalCeldas: number;
  /** Frecuencia esperada más baja de la tabla. */
  esperadaMinima: number;
  /** V de Cramér calculada con el estadístico de este resultado (como en el informe). */
  vCramer: number;
}

/**
 * Prueba chi-cuadrado de independencia (Ecuación 1). La corrección de continuidad de Yates
 * solo se aplica a tablas 2×2. Devuelve null si la tabla no tiene al menos 2 filas y 2 columnas
 * con totales positivos.
 */
export function chiCuadrado(
  observadas: number[][],
  opciones: { alfa?: number; yates?: boolean } = {}
): ResultadoChiCuadrado | null {
  const { alfa = 0.05 } = opciones;
  const tabla = crearTablaCruzada(
    observadas.map((_, i) => String(i)),
    (observadas[0] ?? []).map((_, j) => String(j)),
    observadas
  );
  const r = tabla.filas.length;
  const c = tabla.columnas.length;
  if (r < 2 || c < 2 || tabla.totalesFila.some((t) => t <= 0) || tabla.totalesColumna.some((t) => t <= 0)) {
    return null;
  }
  const yates = (opciones.yates ?? false) && r === 2 && c === 2;

  const esperadas = tabla.totalesFila.map((tf) => tabla.totalesColumna.map((tc) => (tf * tc) / tabla.total));
  let estadistico = 0;
  let celdasEsperadaMenor5 = 0;
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      const e = esperadas[i][j];
      const diferencia = Math.abs(observadas[i][j] - e);
      estadistico += (yates ? Math.max(0, diferencia - 0.5) : diferencia) ** 2 / e;
      if (e < 5) celdasEsperadaMenor5++;
    }
  }
  const gl = (r - 1) * (c - 1);
  const pValor = chiCuadradoPValor(estadistico, gl);
  return {
    estadistico,
    gl,
    pValor,
    alfa,
    valorCritico: chiCuadradoCritico(alfa, gl),
    rechazaH0: pValor < alfa,
    correccionYates: yates,
    esperadas,
    celdasEsperadaMenor5,
    totalCeldas: r * c,
    esperadaMinima: Math.min(...esperadas.flat()),
    vCramer: Math.sqrt(estadistico / (tabla.total * Math.min(r - 1, c - 1)))
  };
}

export interface ResultadoFisher {
  /** p-valor bilateral: suma de las tablas con probabilidad ≤ a la observada. */
  pValor: number;
  /** P(a ≤ observado), cola izquierda. */
  pIzquierda: number;
  /** P(a ≥ observado), cola derecha. */
  pDerecha: number;
}

/** Prueba exacta de Fisher para una tabla 2×2 [[a, b], [c, d]] (distribución hipergeométrica). */
export function fisherExacto2x2(observadas: number[][]): ResultadoFisher {
  const [[a, b], [c, d]] = observadas;
  const fila1 = a + b;
  const columna1 = a + c;
  const n = a + b + c + d;
  const lnFactorial = (k: number) => lnGamma(k + 1);
  const lnCombinaciones = (m: number, k: number) => lnFactorial(m) - lnFactorial(k) - lnFactorial(m - k);
  const probabilidad = (x: number) =>
    Math.exp(lnCombinaciones(columna1, x) + lnCombinaciones(n - columna1, fila1 - x) - lnCombinaciones(n, fila1));

  const minimo = Math.max(0, fila1 - (n - columna1));
  const maximo = Math.min(fila1, columna1);
  const pObservada = probabilidad(a);
  let pValor = 0;
  let pIzquierda = 0;
  let pDerecha = 0;
  for (let x = minimo; x <= maximo; x++) {
    const p = probabilidad(x);
    if (p <= pObservada * (1 + 1e-7)) pValor += p;
    if (x <= a) pIzquierda += p;
    if (x >= a) pDerecha += p;
  }
  return { pValor: Math.min(1, pValor), pIzquierda: Math.min(1, pIzquierda), pDerecha: Math.min(1, pDerecha) };
}

export type MetodoOficial = 'fisher' | 'yates' | 'chi2';

export const NOMBRE_METODO: Record<MetodoOficial, string> = {
  fisher: 'Prueba exacta de Fisher',
  yates: 'Chi-cuadrado con corrección de Yates',
  chi2: 'Chi-cuadrado sin corrección'
};

export interface PruebaIndependencia {
  tabla: TablaCruzada;
  es2x2: boolean;
  sinCorreccion: ResultadoChiCuadrado;
  /** Solo en tablas 2×2. */
  yates: ResultadoChiCuadrado | null;
  /** Solo en tablas 2×2. */
  fisher: ResultadoFisher | null;
  /** Hay al menos una frecuencia esperada menor que 5. */
  hayEsperadaMenor5: boolean;
  /**
   * Regla del grupo. Tablas 2×2: Fisher si alguna E < 5; si no, chi-cuadrado con Yates.
   * Tablas mayores: chi-cuadrado sin corrección.
   */
  metodoOficial: MetodoOficial;
  /** Estadístico χ² del resultado oficial (null si el oficial es Fisher). */
  estadisticoOficial: number | null;
  pValorOficial: number;
  /** V de Cramér del chi-cuadrado oficial (con Yates en 2×2, como en el informe). */
  vCramer: number;
  /** Tablas mayores que 2×2: regla de Cochran (≤ 20 % de celdas con E < 5 y ninguna < 1). */
  aproximacionAdecuada: boolean;
  rechazaH0: boolean;
  alfa: number;
}

/**
 * Prueba de independencia con todos los resultados aplicables y la decisión oficial.
 * Devuelve null si la tabla tiene menos de 2 filas o columnas, o algún total en cero.
 */
export function pruebaIndependencia(tabla: TablaCruzada, alfa = 0.05): PruebaIndependencia | null {
  const sinCorreccion = chiCuadrado(tabla.observadas, { alfa });
  if (!sinCorreccion) return null;
  const es2x2 = tabla.filas.length === 2 && tabla.columnas.length === 2;
  const yates = es2x2 ? chiCuadrado(tabla.observadas, { alfa, yates: true }) : null;
  const fisher = es2x2 ? fisherExacto2x2(tabla.observadas) : null;
  const hayEsperadaMenor5 = sinCorreccion.celdasEsperadaMenor5 > 0;

  let metodoOficial: MetodoOficial = 'chi2';
  if (es2x2) metodoOficial = hayEsperadaMenor5 ? 'fisher' : 'yates';

  const chiOficial = metodoOficial === 'chi2' ? sinCorreccion : (yates ?? sinCorreccion);
  const pValorOficial =
    metodoOficial === 'fisher' ? (fisher?.pValor ?? 1) : metodoOficial === 'yates' ? (yates?.pValor ?? 1) : sinCorreccion.pValor;

  return {
    tabla,
    es2x2,
    sinCorreccion,
    yates,
    fisher,
    hayEsperadaMenor5,
    metodoOficial,
    estadisticoOficial: metodoOficial === 'fisher' ? null : chiOficial.estadistico,
    pValorOficial,
    vCramer: chiOficial.vCramer,
    aproximacionAdecuada:
      es2x2 || (sinCorreccion.celdasEsperadaMenor5 / sinCorreccion.totalCeldas <= 0.2 && sinCorreccion.esperadaMinima >= 1),
    rechazaH0: pValorOficial < alfa,
    alfa
  };
}

// ---------------------------------------------------------------------------
// Escalas Likert
// ---------------------------------------------------------------------------

export interface EstadisticosLikert {
  n: number;
  media: number;
  desviacion: number;
  /** Porcentaje de respuestas 3 o 4 ("De acuerdo" o "Totalmente de acuerdo"). */
  porcentajeAcuerdo: number;
  /** Conteo de respuestas 1, 2, 3 y 4. */
  distribucion: [number, number, number, number];
}

/** Estadísticos de un ítem Likert de 4 puntos; null si no hay respuestas. */
export function estadisticosLikert(valores: Array<1 | 2 | 3 | 4 | undefined>): EstadisticosLikert | null {
  const validos = valores.filter((v): v is 1 | 2 | 3 | 4 => v !== undefined);
  const d = descriptivos(validos);
  if (!d) return null;
  const distribucion: [number, number, number, number] = [0, 0, 0, 0];
  for (const v of validos) distribucion[v - 1]++;
  return {
    n: d.n,
    media: d.media,
    desviacion: d.desviacion,
    porcentajeAcuerdo: (100 * (distribucion[2] + distribucion[3])) / d.n,
    distribucion
  };
}

export interface IndiceAcuerdo {
  totalmenteDeAcuerdo: number;
  parcialmenteDeAcuerdo: number;
  totalmenteEnDesacuerdo: number;
  noSabe: number;
  sinRespuesta: number;
  /** n de la Ecuación 2: respuestas válidas sin contar "No sabe". */
  nValidas: number;
  /** Índice de 0 a 100; null si no hay respuestas válidas. */
  indice: number | null;
}

/**
 * Ecuación (2) del informe: Índice = ((TA + 0,5 · PA) / n) × 100, con n = TA + PA + TD
 * ("No sabe" y vacíos no cuentan).
 */
export function indiceAcuerdo(
  respuestas: Array<'Totalmente de acuerdo' | 'Parcialmente de acuerdo' | 'Totalmente en desacuerdo' | 'No sabe' | undefined>
): IndiceAcuerdo {
  const cuenta = (valor: string) => respuestas.filter((r) => r === valor).length;
  const ta = cuenta('Totalmente de acuerdo');
  const pa = cuenta('Parcialmente de acuerdo');
  const td = cuenta('Totalmente en desacuerdo');
  const nValidas = ta + pa + td;
  return {
    totalmenteDeAcuerdo: ta,
    parcialmenteDeAcuerdo: pa,
    totalmenteEnDesacuerdo: td,
    noSabe: cuenta('No sabe'),
    sinRespuesta: respuestas.filter((r) => r === undefined).length,
    nValidas,
    indice: nValidas > 0 ? ((ta + 0.5 * pa) / nValidas) * 100 : null
  };
}
