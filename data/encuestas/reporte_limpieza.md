# Reporte de limpieza de las encuestas

Generado por `npm run cargar-encuestas` el 2026-11-12 a partir de:

- `data/encuestas/ENCUESTA_DE_OPINION_A_TITULADOS_DE_INGENIERIA_EN_SISTEMAS.xlsx` (Microsoft Forms): 184 respuestas, 167 columnas.
- `data/encuestas/ENCUESTA_EMPLEADORES_II_SISTEMAS_respuestas_1.xlsx` (Google Forms): 80 respuestas, 32 columnas.

Resultado: `public/data/Base_Limpia_Titulados_Empleadores.xlsx` con las hojas Titulados, Empleadores e Items_empleadores. La base se
volvió a leer con el importador de la aplicación sin ningún problema.

## Resumen

| | Titulados | Empleadores |
|---|---:|---:|
| Respuestas en el formulario | 184 | 80 |
| Descartadas | 0 | 2 |
| En la base limpia | 184 | 78 |
| Con al menos una corrección | 35 | 4 |
| Correcciones en total | 52 | 4 |

Afirmaciones de empleadores (ítems): 18.

## Reglas aplicadas

1. **Años escritos como texto → número de años.** «2 años» → 2, «1,5» → 1.5, «Dos años» → 2; los meses
   se dividen entre 12 («6 meses» → 0.5, «Medio año» → 0.5); «Ninguno» o «Nada» → 0; «Más de 10 años» → 10
   (el mínimo declarado). Lo que no es una cantidad de tiempo («n/a», texto sin sentido) queda sin respuesta.
2. **Desempleo mayor que la vida profesional → sin respuesta.**
3. **Respuestas de prueba sin contenido → se descartan** (organización con menos de dos letras distintas,
   como «lll» o «G»), igual que las filas sin los campos obligatorios.
4. **Selección múltiple** («;» en Microsoft Forms, JSON en las actividades, «,» en los cargos de Google
   Forms) → lista separada por «;», que db:seed guarda en las tablas intermedias.
5. **Etiquetas normalizadas a los catálogos** de `src/data/catalogos.ts` (por ejemplo «DIRECCIÓN DE
   POSGRADO FCyT» → «Posgrado FCyT», «Grande (100 funcionarios o más)» → «Grande»). Un rubro o cargo
   escrito en «Otro» cuenta como «Otro»; un rubro de empleador fuera del catálogo, como «Otros».

## Filas descartadas

| Hoja | Respuesta | Motivo |
|---|---:|---|
| Empleadores | 32 | Respuesta de prueba (organización «lll») |
| Empleadores | 44 | Respuesta de prueba (organización «G») |

## Correcciones por regla

### Titulados · Tiempo escrito como texto; se convierte a años (46)

| Id | Columna | Antes | Después |
|---:|---|---|---|
| 12 | anios_desempleado | 2 MESES | 0.17 |
| 15 | anios_desempleado | 4 meses | 0.33 |
| 20 | anios_vida_profesional | 2 años | 2 |
| 20 | anios_desempleado | 2 meses | 0.17 |
| 36 | anios_desempleado | 1 año | 1 |
| 38 | anios_vida_profesional | 20 años | 20 |
| 38 | anios_desempleado | 1 año | 1 |
| 56 | anios_vida_profesional | 1 año | 1 |
| 56 | anios_desempleado | Unos 3 meses | 0.25 |
| 57 | anios_vida_profesional | 2 anios | 2 |
| 57 | anios_desempleado | 6 meses | 0.5 |
| 70 | anios_desempleado | 1 año | 1 |
| 71 | anios_vida_profesional | 15 años | 15 |
| 71 | anios_desempleado | 1 año | 1 |
| 76 | anios_vida_profesional | 7 años | 7 |
| 76 | anios_desempleado | 4 años | 4 |
| 77 | anios_desempleado | 6 meses | 0.5 |
| 82 | anios_vida_profesional | 25 años | 25 |
| 82 | anios_desempleado | 1 año | 1 |
| 90 | anios_vida_profesional | 5 años | 5 |
| 90 | anios_desempleado | 1 año | 1 |
| 96 | anios_desempleado | 2 meses | 0.17 |
| 98 | anios_desempleado | 5 meses | 0.42 |
| 100 | anios_vida_profesional | 2 años | 2 |
| 100 | anios_desempleado | 1 año | 1 |
| 102 | anios_desempleado | 6 meses | 0.5 |
| 119 | anios_desempleado | Ninguno, siempre estuve con trabajo | 0 |
| 121 | anios_vida_profesional | 12 años | 12 |
| 124 | anios_vida_profesional | 14 años | 14 |
| 124 | anios_desempleado | 1 año | 1 |
| 134 | anios_vida_profesional | 8 años | 8 |
| 134 | anios_desempleado | 9 meses | 0.75 |
| 138 | anios_desempleado | Nada | 0 |
| 140 | anios_desempleado | 6 meses | 0.5 |
| 152 | anios_vida_profesional | 15 años | 15 |
| 152 | anios_desempleado | ninguna | 0 |
| 166 | anios_vida_profesional | Dos años | 2 |
| 166 | anios_desempleado | Medio año | 0.5 |
| 168 | anios_desempleado | 6 meses - voluntad propia | 0.5 |
| 169 | anios_desempleado | 6 meses | 0.5 |
| 172 | anios_vida_profesional | 20 años | 20 |
| 172 | anios_desempleado | 5 años | 5 |
| 178 | anios_vida_profesional | 1 año | 1 |
| 178 | anios_desempleado | 3 meses | 0.25 |
| 182 | anios_vida_profesional | Más de 10 años | 10 |
| 182 | anios_desempleado | 5 años | 5 |

### Titulados · No es una cantidad de tiempo; se deja sin respuesta (3)

| Id | Columna | Antes | Después |
|---:|---|---|---|
| 79 | anios_vida_profesional | n/a | — |
| 126 | anios_vida_profesional | Gjvu | — |
| 126 | anios_desempleado | Vjbk | — |

### Titulados · Supera los años de vida profesional; se deja sin respuesta (2)

| Id | Columna | Antes | Después |
|---:|---|---|---|
| 91 | anios_desempleado | 5 | — |
| 141 | anios_desempleado | 3 | — |

### Titulados · Opción fuera del catálogo; se omite (1)

| Id | Columna | Antes | Después |
|---:|---|---|---|
| 142 | actividades | R.R.H.H. | — |

### Empleadores · Opción fuera del catálogo; se omite (2)

| Id | Columna | Antes | Después |
|---:|---|---|---|
| 34 | cargos | Docentes | — |
| 60 | cargos | Control de calidad se software | — |

### Empleadores · Rubro fuera del catálogo; se clasifica como Otros (2)

| Id | Columna | Antes | Después |
|---:|---|---|---|
| 58 | rubro | Seguridad informática / ciberseguridad | Otros |
| 74 | rubro | Análisis de datos / inteligencia de negocios | Otros |

## Identificadores

- **Titulados:** conservan el Id de Microsoft Forms (1 a 184). Los ids 1 a 148 son los mismos
  titulados de la base limpia anterior.
- **Empleadores:** los 51 de la base anterior conservan su id (1 a 51: las primeras respuestas sin
  las de prueba). Las respuestas nuevas usan su número de respuesta en el formulario (54 a 80),
  así que nunca toman un id ya usado.

## Datos que no pasan a la base limpia

- Datos de contacto: correo, nombre, teléfono y LinkedIn de los titulados; correo de los empleadores.
- Textos libres de «Otra asignatura» y «Otr@ área», que no corresponden a ninguna opción del catálogo.
- Columnas de puntos y comentarios que agrega Microsoft Forms.

## Diferencias con la base limpia anterior

- **Titulados**: 148 en la base anterior; 148 siguen con el mismo id y 71 no cambian.
  - `programa`: 17 (ids 9, 20, 39, 41, 43, 48, 52, 56, 60, 68, 109, 112, 127, 129, 131, …)
  - `asignaturas_no_utiles`: 3 (ids 14, 90, 97)
  - `empresa`: 6 (ids 50, 108, 125, 138, 139, 147)
  - `actividades`: 58 (ids 69, 70, 71, 72, 74, 75, 76, 77, 78, 79, 80, 82, 85, 87, 88, …)
  - `red_contactos`: 1 (ids 84)
  - `remuneracion`: 17 (ids 101, 103, 105, 106, 110, 112, 114, 116, 120, 122, 130, 132, 134, 137, 140, …)
  - `interes_posgrado`: 1 (ids 132)
  - `anios_desempleado`: 1 (ids 138)
  - `asignaturas_ventaja`: 1 (ids 143)
- **Empleadores**: 51 en la base anterior; 51 siguen con el mismo id y 37 no cambian.
  - `tendencias`: 8 (ids 2, 3, 9, 13, 15, 18, 31, 41)
  - `habilidades`: 7 (ids 5, 6, 13, 20, 24, 30, 36)
  - `items_likert`: 7 (ids 5, 6, 13, 20, 24, 30, 36)

Los cambios en registros que ya existían vienen del Excel crudo, que es la fuente: la base anterior tenía
textos dañados (un «0» intercalado en algunos programas y nombres de empresa, o la situación laboral en el
campo empresa), respuestas sin leer (actividades a partir del id 69, varias remuneraciones a partir del
101), «Contabilidad Básica» quitada de 3 listas en que el titulado sí la marcó, «Inteligencia Artificial»
agregada al id 143 desde «Otra asignatura», y en 7 empleadores el texto de habilidades truncado y pegado
con la afirmación 1, que quedaba vacía. En las listas solo se compara el contenido, no el orden (ahora
siguen el orden del catálogo).
