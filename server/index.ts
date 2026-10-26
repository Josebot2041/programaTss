/**
 * Punto de entrada del backend en desarrollo: levanta la API en el puerto 4000.
 */

import { crearApp } from './app';

const PUERTO = Number(process.env.PORT ?? 4000);

crearApp().listen(PUERTO, () => {
  console.log(`API escuchando en http://localhost:${PUERTO}/api`);
});
