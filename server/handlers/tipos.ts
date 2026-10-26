/**
 * Contrato de los manejadores de la API. No dependen de Express: reciben lo mínimo de la
 * petición y devuelven estado + cuerpo JSON, así sirven igual para Express o para funciones
 * serverless de Vercel (api/*.ts).
 */

export interface Peticion {
  /** Cuerpo JSON ya interpretado (undefined en GET). */
  body?: unknown;
}

export interface Respuesta {
  status: number;
  body: unknown;
}

export type Manejador = (peticion: Peticion) => Promise<Respuesta>;

export type Metodo = 'GET' | 'POST';

/** Manejadores de una ruta, por método HTTP. */
export type ManejadoresRuta = Partial<Record<Metodo, Manejador>>;

/** Elige el manejador según el método (útil en Vercel, donde un archivo atiende todos los métodos). */
export function despachar(ruta: ManejadoresRuta, metodo: string | undefined, peticion: Peticion): Promise<Respuesta> {
  const manejador = ruta[(metodo ?? 'GET').toUpperCase() as Metodo];
  return manejador ? manejador(peticion) : Promise.resolve({ status: 405, body: { error: 'Método no permitido' } });
}
