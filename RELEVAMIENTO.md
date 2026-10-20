# Relevamiento técnico – Simulador ARCU-SUR (versión del compañero)

> Fase 1, solo relevamiento. Este archivo es el único cambio en el repositorio; no se modificó ningún otro.
> Fecha: 2026-10-20 · Commit revisado: `2000127` ("Version original del companero (pendrive)")

---

## a) Resumen

**Qué hace.** Es una SPA (aplicación de una sola página) para la materia Taller de Simulación de Sistemas (UMSS) que presenta el estudio de titulados y empleadores de Ingeniería de Sistemas con enfoque ARCU-SUR. Tiene:

- pestañas de análisis: perfil de titulados (HU1/HU2), mercado laboral, valoración curricular (HU4), chi-cuadrado (HU3) y plan estratégico;
- un motor de simulación (generador congruencial mixto "Coss Bu" y 3 escenarios);
- formularios de encuesta para titulados y empleadores;
- una pestaña de carga/exploración de datos con importación CSV y exportación CSV;
- un informe imprimible (`window.print()`).

Todo funciona en el navegador. No hay backend ni persistencia: los datos viven en el estado de React y se pierden al recargar la página.

**Stack.** React 19.3 + TypeScript 7.0 + Vite 8.3 + Tailwind CSS 4.3 + lucide-react (iconos). Se generó con Google AI Studio. Los gráficos son `div` con estilos; no usa ninguna librería de gráficos.

**Cómo se ejecuta.**

```bash
npm install
npm run dev      # vite --port=3000 --host=0.0.0.0  → http://localhost:3000
npm run build    # build de producción en dist/
npm run lint     # tsc --noEmit
```

**Variables de entorno.** `.env.example` declara `GEMINI_API_KEY` y `APP_URL`, que vienen de la plantilla de AI Studio, pero **el código no usa ninguna de las dos**. La única variable que se lee es `DISABLE_HMR`, en [vite.config.ts](vite.config.ts) y es opcional. **La app no necesita ninguna variable para funcionar.**

### Resultado de la ejecución

| Paso | Resultado |
|---|---|
| `npm install` | No se volvió a ejecutar: `node_modules` ya existía y `npm ls --depth=0` muestra todas las dependencias instaladas, sin faltantes ni conflictos. Se omitió para no reescribir `package-lock.json`. |
| `npm run dev` | El servidor ya estaba levantado; `http://localhost:3000` responde **HTTP 200**. |
| `tsc --noEmit` | **0 errores.** Ojo: `tsconfig.json` no activa `strict`, así que los chequeos son laxos. |
| `vite build` | **OK** (1679 módulos, JS de 496 kB / 126 kB gzip). Un solo aviso: `__dirname` en `vite.config.ts:11` no es compatible con el futuro `configLoader: 'native'`. |
| Errores de ejecución en consola | No se observaron fallos al cargar. Los problemas encontrados son de **lógica y datos**, no de compilación. |

> Nota: las observaciones del recorrido manual quedaron como plantilla en el mensaje (`[escribe aquí lo que viste mal, o "ninguna"]`), así que no están incorporadas.

---

## b) Mapa de archivos y componentes

### Raíz

| Archivo | Qué hace |
|---|---|
| [package.json](package.json) | Scripts y dependencias. El nombre es `react-example`. `@google/genai`, `express`, `dotenv` y `motion` están instalados **pero no se importan en ningún archivo**. |
| [vite.config.ts](vite.config.ts) | Plugins de React y Tailwind, alias `@`, HMR configurable. No inyecta ninguna API key. |
| [tsconfig.json](tsconfig.json) | ES2022, `jsx: react-jsx`, sin `strict`. |
| [.env.example](.env.example) | Plantilla de AI Studio (`GEMINI_API_KEY`, `APP_URL`). Ninguna se usa. |
| [README.md](README.md) | README genérico de AI Studio, en inglés. Pide configurar `GEMINI_API_KEY` sin que haga falta. |
| [metadata.json](metadata.json) | Metadatos de AI Studio. Declara `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`, que no se usa. |
| [index.html](index.html) | HTML base. Carga las fuentes Plus Jakarta Sans y JetBrains Mono. |
| `public/assets/aistudio/*.csv` | Dos CSV "reales" adjuntos que en realidad son **datos de prueba**: 2 titulados y 1 empleador, con correos y teléfonos inventados. |
| `public/assets/aistudio/*.pdf, *.png` | El PDF del informe y una imagen, servidos públicamente. |
| `.aistudio/` | Artefacto de AI Studio (una imagen) que quedó versionado. |

### `src/`

| Archivo | Qué hace |
|---|---|
| [src/main.tsx](src/main.tsx) | Monta `<App/>`. |
| [src/App.tsx](src/App.tsx) | Estado global (`titulados`, `empleadores`, pestaña activa) y enrutado por pestañas. **Solo pasa los datos** a `TabProfileGraduates`, `TabLaborMarket` y `TabSurveysCollection`. `TabChiSquareAnalysis`, `TabSimulationEngine` y `TabCurriculumEvaluation` **no reciben datos**. |
| [src/index.css](src/index.css) | `@import "tailwindcss"`. |
| [src/types/index.ts](src/types/index.ts) | Tipos `Titulado`, `Empleador`, `ChiSquareResult`, etc. Sus categorías **no coinciden** con las etiquetas del Excel real. |
| [src/data/officialData.ts](src/data/officialData.ts) | **Genera una base sintética** de 148 titulados y 51 empleadores a partir de arreglos fijos para "calzar" con el informe. **No es la base real.** |
| [src/data/strategicPlan.ts](src/data/strategicPlan.ts) | Las 18 afirmaciones de empleadores (el texto coincide con la hoja `Items_empleadores`), las 4 dimensiones con índices fijos y las tablas 11, 12 y 13 del informe. |
| [src/data/dictionary.ts](src/data/dictionary.ts) | Diccionario de variables (Anexo C), en texto. |
| [src/utils/statistics.ts](src/utils/statistics.ts) | Descriptivos, índice de acuerdo de empleadores (Ec. 2) y chi-cuadrado con p-valor aproximado. `calculateDescriptiveStats` y `calculateEmployerAgreementIndex` **no se usan en ningún componente**. |
| [src/utils/cossBu.ts](src/utils/cossBu.ts) | Generador congruencial mixto (a=8121, c=28411, m=100000), pruebas de uniformidad, `sampleDiscrete` (transformada inversa, **sin uso**) y los escenarios A, B y C. |
| [src/utils/csvParser.ts](src/utils/csvParser.ts) | Parser CSV (`;` o `,`) y mapeo heurístico de columnas para titulados y empleadores. |
| [src/components/Sidebar.tsx](src/components/Sidebar.tsx) | Navegación lateral (10 secciones) y contadores. |
| [src/components/Header.tsx](src/components/Header.tsx) | Título y subtítulo por pestaña, botón de informe. |
| [src/components/TabOverview.tsx](src/components/TabOverview.tsx) | Portada con resumen ejecutivo. Las cifras están fijas (148, 51, 83.1 %, 67.5 %, 64.4…). |
| [src/components/TabProfileGraduates.tsx](src/components/TabProfileGraduates.tsx) | HU1 y HU2: estadísticos de vida profesional, histograma, edades, género, áreas e instituciones de posgrado, financiamiento. **Todo fijo**, y el filtro Junior/Consolidado no hace nada. |
| [src/components/TabLaborMarket.tsx](src/components/TabLaborMarket.tsx) | Inserción laboral, salarios, rubros, tecnologías y habilidades. Recibe los datos pero **no los usa**: todo es fijo. |
| [src/components/TabCurriculumEvaluation.tsx](src/components/TabCurriculumEvaluation.tsx) | HU4: Tabla 7 (medias y DE), asignaturas, aspectos y las 18 afirmaciones de empleadores. **Todo fijo.** Las barras Likert son "ilustrativas" e iguales para todos los ítems. |
| [src/components/TabChiSquareAnalysis.tsx](src/components/TabChiSquareAnalysis.tsx) | HU3: Tabla 4 con 4 pruebas (**valores fijos**), un mapa de calor fijo y una **calculadora chi-cuadrado editable**, que es lo único que se calcula. |
| [src/components/TabSimulationEngine.tsx](src/components/TabSimulationEngine.tsx) | Escenarios A, B y C, y validación del generador (muestra de números, media, varianza y χ² de uniformidad calculados; el resto de la Tabla 10 está fijo). |
| [src/components/TabSurveysCollection.tsx](src/components/TabSurveysCollection.tsx) | Importación CSV, explorador de registros, exportación CSV, **formularios duplicados** (simplificados), diccionario y reglas de limpieza. |
| [src/components/FormTituladosSurvey.tsx](src/components/FormTituladosSurvey.tsx) | Encuesta completa de titulados: 5 secciones, Likert y asignaturas. |
| [src/components/FormEmpleadoresSurvey.tsx](src/components/FormEmpleadoresSurvey.tsx) | Encuesta de empleadores: perfil, textos abiertos y 18 ítems Likert. |
| [src/components/TabStrategicPlan.tsx](src/components/TabStrategicPlan.tsx) | Matriz de hallazgos, FODA y plan de acción (tablas 11 a 13, estáticas). |
| [src/components/OfficialReportModal.tsx](src/components/OfficialReportModal.tsx) | Informe imprimible, estático. |

---

## c) Cumplimiento de la guía

> Criterio: **Sí** = implementado y calculado a partir de los datos · **Parcial** = existe pero es fijo, incompleto o tiene errores · **No** = no existe.
> Se contrastó cada valor con lo calculado sobre `Base_Limpia_Titulados_Empleadores.xlsx`. El archivo **no está en `data/`**: se encontró en `C:\Users\Gabriel\Downloads\`.

| Requisito | ¿Cumple? | Dónde está | Observación |
|---|---|---|---|
| **HU1** – media, mediana y DE de años de vida profesional | **Parcial** | [TabProfileGraduates.tsx:117-154](src/components/TabProfileGraduates.tsx#L117-L154) | Los valores mostrados (n=145, media 8.83, mediana 6, DE 7.92, Q1=2, Q3=14) **coinciden con el Excel real**, pero están **escritos a mano**. `calculateDescriptiveStats` existe y nunca se llama. Sobre la base sintética que carga la app, el valor real sería media 9.25 y DE 8.34, así que los números fijos ni siquiera corresponden a los datos en memoria. |
| **HU1** – segmentación junior (<5) vs consolidado | **Parcial** | [TabProfileGraduates.tsx:19-26, 85-99](src/components/TabProfileGraduates.tsx#L19-L26) | 62 (42.8 %) / 83 (57.2 %), fijo y correcto respecto al Excel. Los botones de filtro cambian el estado, pero `filteredTitulados` **no se usa en ninguna parte**, así que el filtro no tiene efecto. No muestra descriptivos por segmento (reales: junior media 1.93, DE 1.06; consolidado media 13.99, DE 6.81). |
| **HU2** – frecuencias de nivel de posgrado | **Parcial** | [TabProfileGraduates.tsx:55-60](src/components/TabProfileGraduates.tsx#L55-L60) | Diplomado 66, Maestría 27, Especialidad 3, Doctorado 2: fijo y correcto. |
| **HU2** – frecuencias de área de posgrado | **Parcial** | [TabProfileGraduates.tsx:37-43](src/components/TabProfileGraduates.tsx#L37-L43) | IA 54, Software 29, Redes 25, BD 10, Robótica 5 (n=123): fijo y correcto. |
| **HU2** – alerta si las 2 áreas principales superan el 70 % | **No** | [TabProfileGraduates.tsx:332-334](src/components/TabProfileGraduates.tsx#L332-L334) | No hay regla. Hay un badge fijo, "Concentración Crítica: 67.5 %", que **contradice el umbral** (67.5 % < 70 %, no correspondería alerta). Si la regla se aplica al **nivel** de posgrado, los 2 primeros suman **94.9 %** y la alerta sí debería saltar, pero no se evalúa. |
| **HU3** – tabla cruzada nivel/área × financiamiento | **Parcial** | [TabChiSquareAnalysis.tsx:15-68](src/components/TabChiSquareAnalysis.tsx#L15-L68) | No se arma ninguna tabla cruzada con los datos; solo hay una fila fija en la "Tabla 4". La calculadora editable tiene precargado otro cruce (sector × remuneración). |
| **HU3** – χ², gl, p-valor, valor crítico e interpretación | **Parcial** | Tabla 4 fija; calculadora en `statistics.ts` (archivo ya reemplazado) | La app muestra χ²=2.206, gl=1, p=0.138, "Fisher 0.109" y "27/32 maestrías", como **texto fijo**. *Corrección posterior:* con la agrupación del informe (Diplomado contra Especialidad/Maestría/Doctorado, Recursos propios contra Beca), la base real da [[63, 3], [27, 5]] y reproduce esos valores (Yates χ²=2.206, p=0.1375; Fisher p=0.1089). Lo único incorrecto es la etiqueta: "27/32" corresponde a Especialidad/Maestría/Doctorado, no a "maestrías". En la versión inicial de este relevamiento comparé Diplomado contra solo Maestría y por eso concluí, erróneamente, que no se podía reproducir. La 4×3 sin agrupar tiene **10 de 12 celdas con E<5**, por eso se agrupa. La calculadora sí calculaba, pero con p aproximado y valor crítico aproximado para muchos gl (ver d). |
| **HU4** – medias y DE de competencias/valoración | **Parcial** | [TabCurriculumEvaluation.tsx:22-57](src/components/TabCurriculumEvaluation.tsx#L22-L57) | Tabla 7 fija. Los valores coinciden con el Excel (2.78/0.63, 2.63/0.62, 3.25/0.75, 2.67/0.78), pero no se calculan. |
| **HU4** – radar | **No** | — | No hay gráfico radar. |
| **HU4** – valoración de empleadores (18 ítems y 4 dimensiones) | **Parcial** | [strategicPlan.ts:119-144](src/data/strategicPlan.ts#L119-L144), [TabCurriculumEvaluation.tsx:450-492](src/components/TabCurriculumEvaluation.tsx#L450-L492) | Índices fijos 64.4 / 65.6 / 43.8 / 34.5; recalculados sobre el Excel (agregado por dimensión, Ec. 2) dan 64.1 / 65.6 / 43.6 / 34.1. Las barras Likert de la Figura 22 son **iguales para todos los ítems** (48/38/10/4 % o 16/30/40/14 %), no salen de los datos. `calculateEmployerAgreementIndex` no se usa. |
| **HU5** – exportación CSV | **Parcial** | [TabSurveysCollection.tsx:213-259](src/components/TabSurveysCollection.tsx#L213-L259) | Exporta solo 12 columnas de titulados y 8 de empleadores. Sin BOM ni `;`, así que Excel en español rompe tildes y columnas. Los titulados no se escapan. Usa `data:` + `encodeURI`, que se corta con `#`. |
| **HU5** – exportación Excel | **No** | — | No existe. La UI dice "CSV/Excel" pero no hay librería ni código para `.xlsx`. |
| **HU5** – mapas de calor | **Parcial** | [TabChiSquareAnalysis.tsx:71-243](src/components/TabChiSquareAnalysis.tsx#L71-L243) | Hay un solo mapa de calor (área × institución) y sus valores están fijos. |
| **Formularios** – campos obligatorios | **Parcial** | FormTitulados / FormEmpleadores | Solo `required` en años de vida profesional y nombre de la organización. El resto viene **precargado con valores por defecto**: no se puede distinguir "no respondió" de "eligió la opción por defecto". |
| **Formularios** – desempleado ≤ vida profesional | **No** | [FormTituladosSurvey.tsx:249-265](src/components/FormTituladosSurvey.tsx#L249-L265), [TabSurveysCollection.tsx:739-750](src/components/TabSurveysCollection.tsx#L739-L750) | Sin validación: se puede guardar 0 años de vida con 10 de desempleo. Solo el parser CSV recorta en silencio. |
| **Formularios** – sin texto libre en campos categóricos | **Parcial** | [TabSurveysCollection.tsx:911-919](src/components/TabSurveysCollection.tsx#L911-L919) | Los formularios principales usan `select`. El formulario duplicado de empleadores tiene **"Rubro" como texto libre**. Faltan opciones "Otro" que sí existen en la base (lugar, institución, cargo, rubro). |
| **Simulación** – generador propio (congruencial mixto) | **Parcial** | [cossBu.ts:8-31](src/utils/cossBu.ts#L8-L31) | Sí: Xₙ₊₁=(8121·Xₙ+28411) mod 100000, con período completo verificado (100 000, cumple Hull-Dobell). **Pero** se usa `Math.random()` para perturbar la semilla en cada "Simular" ([TabSimulationEngine.tsx:60,64,68,631](src/components/TabSimulationEngine.tsx#L60)), y el **período se agota** dentro de una sola corrida (ver d, C5). |
| **Simulación** – transformada inversa | **Parcial** | [cossBu.ts:105-115, 170-178, 345-366](src/utils/cossBu.ts#L105-L115) | Se aplica la búsqueda en la distribución acumulada (transformada inversa discreta) escrita en línea en los escenarios A y C. El método `sampleDiscrete` existe y no se usa. |
| **Simulación** – escenarios | **Sí** | [cossBu.ts:128-398](src/utils/cossBu.ts#L128-L398) | 3 escenarios: A (posgrados por área), B (becas) y C (pasantías). Sus parámetros están **fijos**; no se derivan de los datos cargados. |
| **Simulación** – réplicas | **Sí** | idem | Configurables en A (10–100); fijas en B (30) y C (50). Por el agotamiento del período, **no son independientes**. |
| **Simulación** – intervalos de confianza | **Parcial** | [cossBu.ts:195-226](src/utils/cossBu.ts#L195-L226) | Solo en A, con z=1.96 (el comentario dice t-Student). B y C no tienen IC. La "prueba t p<0.001" de B es texto fijo. |
| **Simulación** – validación | **Parcial** | [cossBu.ts:58-99](src/utils/cossBu.ts#L58-L99), [TabSimulationEngine.tsx:674-727](src/components/TabSimulationEngine.tsx#L674-L727) | Se calculan media, varianza y χ² de uniformidad (10 clases). Las filas de bondad de ajuste simulado vs. real (χ²=2.069 y proporciones) y "Sí (Ciclo Completo)" son **fijas**. No hay prueba de independencia (corridas o series). |
| **Datos reales** – ¿puede importar la base? | **No** | [csvParser.ts](src/utils/csvParser.ts), [TabSurveysCollection.tsx:467-477](src/components/TabSurveysCollection.tsx#L467-L477) | Ver detalle abajo. |

### Comparación de campos con `Base_Limpia_Titulados_Empleadores.xlsx`

El Excel tiene 3 hojas: **Titulados** (148 filas × 42 columnas), **Empleadores** (51 × 30) e **Items_empleadores** (18 × 2).

**¿Puede importarla? No.**

1. No lee `.xlsx`: el `<input>` acepta solo `.csv, .txt` y se lee con `readAsText`, aunque la UI dice ".csv / .xlsx".
2. Aun convirtiendo cada hoja a CSV, el mapeo heurístico (`header.includes(...)`) produce datos incorrectos:

| Campo en el Excel | Qué hace el parser | Efecto |
|---|---|---|
| `satisfaccion_global`, `concordancia_formacion`, `pertinencia_labores`, `opinion_posgrado_fcyt` (texto: "De acuerdo", "En desacuerdo"…) | Hace `parseInt` sobre el texto, obtiene `NaN` y usa **3** por defecto | Todas las valoraciones quedan en 3; HU4 se anula. |
| `pertinencia_labores` | Busca primero `importanciaformacion`, que coincide con **`importancia_formacion_negocio`** | Lee la columna equivocada. |
| `anios_desempleado` | Busca `aniosdesempleo` / `desempleo`; ninguno es subcadena de `aniosdesempleado` | Desempleo = **0** para todos. |
| `rubro`, `cargo`, `sector` | **Forzados** a "Desarrollo de Software", "Desarrollo" y "Sector privado" ([csvParser.ts:185-187](src/utils/csvParser.ts#L185-L187)) | Se pierde el mercado laboral. |
| `departamento`, `antiguedad_trabajo`, `medio_obtencion`, `remuneracion`, `numero_empleos`, `razon_no_trabaja`, emprendimiento (5 columnas), `primer_empleo`, `red_contactos`, `programa`, `empresa` | No se leen | Se pierden. |
| `actividades`, `aspectos_utiles`, `aspectos_mejorar`, asignaturas | Si vienen vacíos se rellenan con **valores inventados** ([csvParser.ts:193-197](src/utils/csvParser.ts#L193-L197)) | Introduce datos falsos. |
| Empleadores `tipo` = "Público" | `includes('pub')` no coincide con "**púb**lico" (tilde) | Los 12 públicos pasan a privados. |
| Empleadores `item_01` … `item_18` (texto) | Busca 10 columnas `likertConfianza…`, inexistentes | Las 10 quedan en "No sabe" y no se leen los 18 ítems. |
| Empleadores `tendencias` | Busca `areasemergentes` / `herramientastecnologicas` | Se reemplaza por un texto fijo. |
| Hoja `Items_empleadores` | No se usa | Los textos están copiados en `strategicPlan.ts`; coinciden. |

**Diferencias de etiquetas** que hay que normalizar: `SI`/`NO` frente a `Sí`/`No`; `Hombre`/`Mujer` frente a `Masculino`/`Femenino`; `Privado`/`Público` frente a `Sector privado`; tamaños `Grande`/`Micro`/`Pequeña`/`Mediana` frente a `Gran empresa (>200)`…; remuneración `Entre Bs. 5.001 - Bs. 7.000` frente a `5 001 - 7 000`; cargos `Ejecutivo`/`Help Desk` frente a `Ejecutivo / Gerencial`/`Soporte / Help desk`; antigüedad con 8 tramos frente a 4; Likert de empleadores `Totalmente desacuerdo` frente a `Totalmente en desacuerdo`.

---

## d) Problemas encontrados (por gravedad)

### 🔴 Crítico

**C1. Los análisis no dependen de los datos.** Las pestañas de titulados, mercado, currículo, chi-cuadrado, simulación, portada e informe muestran cifras **escritas a mano**. Agregar una encuesta o importar un archivo solo cambia los contadores. La UI afirma lo contrario: "se recalcularon en tiempo real" ([TabSurveysCollection.tsx:199, 530](src/components/TabSurveysCollection.tsx#L199)) y "se actualizarán inmediatamente" ([FormTituladosSurvey.tsx:156-158](src/components/FormTituladosSurvey.tsx#L156-L158)). Es el defecto de fondo: la app es un informe estático con apariencia de herramienta de análisis.

**C2. La "Base Oficial" en memoria es sintética e inventada.** [officialData.ts](src/data/officialData.ts) construye los registros con arreglos y fórmulas:
- `anios_desempleado` se calcula con `(i % 5) * 0.5 + 0.25` ([línea 140](src/data/officialData.ts#L140));
- los 3 nulos se rellenan con 5.0 ([línea 139](src/data/officialData.ts#L139));
- las valoraciones Likert se asignan por índice;
- se asignan **respuestas Likert inventadas a organizaciones con nombres reales** (Jalasoft, Banco Unión, ENTEL…) que no figuran en la base real.

No reproduce el informe: media 9.25 frente a 8.83, DE 8.34 frente a 7.92, satisfacción 2.92 frente a 2.78. El cruce nivel × financiamiento es completamente distinto (los 66 diplomados con recursos propios frente al real 63/2/1). Cualquier cálculo que se conecte sobre esta base dará resultados falsos.

**C3. No puede trabajar con los datos reales.** No lee `.xlsx`, y el mapeo CSV anula o corrompe la mayoría de los campos (tabla de la sección c).

**C4. El resultado de HU3 es fijo (no se calcula).** *Corregido después de la fase 1:* con la agrupación del informe, los valores mostrados sí coinciden con la base real (ver la fila HU3). El problema es que son texto fijo y que la etiqueta "27/32 maestrías" es incorrecta (son Especialidad/Maestría/Doctorado). El grupo fijó la regla oficial: Fisher si alguna E<5 y, si no, Yates, mostrando siempre los tres valores.

**C5. El generador se agota dentro de cada corrida.** Con m = 100 000 y los parámetros por defecto, cada corrida consume aproximadamente:
- escenario A: **116 658** números (40 réplicas × ~2 917);
- escenario B: **159 600**;
- escenario C: **100 000**, exactamente el período.

La secuencia se repite dentro de la misma simulación, así que las réplicas no son independientes y los IC quedan artificialmente estrechos.

### 🟠 Importante

**I1. Uso de `Math.random()`** en [TabSimulationEngine.tsx:60, 64, 68, 631](src/components/TabSimulationEngine.tsx#L60) para alterar la semilla. Hace la simulación irreproducible y contradice el uso exclusivo del generador propio.

**I2. Parámetros y conclusiones fijos en la simulación.** Probabilidades fijas (0.83, 0.309, 0.35, 0.082, 0.108 y la distribución del tiempo al primer empleo). Interpretaciones con números fijos que no siguen a la simulación ("~39.9 inscritos", "88 %", "96.4 → 114.8 (+19.1 %)", "p < 0.001", "64.4 %", "2.5 %") en [TabSimulationEngine.tsx:252-256, 308-313, 408-413, 575-593](src/components/TabSimulationEngine.tsx#L252-L256). La etiqueta "Prob >15" no cambia con el umbral y el código usa `>=` ([línea 273](src/components/TabSimulationEngine.tsx#L273), [cossBu.ts:205](src/utils/cossBu.ts#L205)).

**I3. Formularios sin validación y con sesgo.**
- No se valida desempleado ≤ vida profesional.
- Todos los campos llegan precargados. Los 18 Likert de empleadores vienen **precargados con el patrón del informe** ([FormEmpleadoresSurvey.tsx:45-55](src/components/FormEmpleadoresSurvey.tsx#L45-L55)), lo que induce respuestas.
- `availableCargos` y `toggleCargo` están definidos pero **nunca se muestran**, así que siempre se guardan los cargos por defecto.
- `aspectos_utiles`, `aspectos_mejorar` y `actividades` se guardan con valores fijos.
- Se guarda `tiempo_primer_empleo` aunque el campo esté oculto ("No trabaja").
- El formulario duplicado de [TabSurveysCollection.tsx](src/components/TabSurveysCollection.tsx#L261-L298):
  - convierte 0 años en **1** (`|| 1`, línea 265);
  - no tiene lógica condicional (guarda sector, rubro y salario aunque "No trabaja");
  - tiene el rubro de empleador como texto libre.

**I4. El filtro Junior/Consolidado no funciona** ([TabProfileGraduates.tsx:22](src/components/TabProfileGraduates.tsx#L22): la variable se calcula y nunca se usa).

**I5. La regla de alerta de HU2 (>70 %) no existe** y el badge fijo "Concentración Crítica: 67.5 %" la contradice.

**I6. Exportación incompleta.** Sin Excel; CSV parcial, sin BOM ni `;`, sin escapar valores y con `data:` URI.

**I7. HU4 sin radar** y con barras Likert iguales para los 18 ítems. Los índices por dimensión no se calculan.

**I8. Imprecisiones en [statistics.ts](src/utils/statistics.ts).**
- El valor crítico solo está tabulado para algunos gl; para el resto usa `df + 1.96·√(2df)` (gl=44: 62.39 frente a 60.48 exacto).
- El p-valor usa la aproximación de Wilson-Hilferty recortada a [0.0001, 0.9999] (gl=1: 0.0275 frente a 0.0292 exacto).
- `isSignificant` usa `chi2 > crítico || p < 0.05`, y las dos condiciones pueden discrepar.
- No avisa automáticamente cuando hay celdas con E<5 ni ofrece Fisher.
- Los cuartiles se toman por índice, sin interpolar.
- Falla con una matriz vacía (`matrix[0].length`).

### 🟡 Menor

**M1. Seguridad: no hay API key expuesta.**
- Gemini no se usa en `src/`.
- `vite.config.ts` no inyecta ninguna clave.
- El bundle compilado no contiene `GEMINI`, `API_KEY` ni `AIza`.
- No existe `.env.local`, y `.gitignore` excluye `.env*`.

Riesgos menores:
- `.env.example`, `README.md` y `metadata.json` piden `GEMINI_API_KEY` sin necesidad. Invitan a configurar una clave que, si en el futuro se usa en el frontend, quedaría expuesta.
- `--host=0.0.0.0` publica el servidor de desarrollo en toda la red local.
- `public/assets/aistudio/*.csv` sirve públicamente campos de email, teléfono y LinkedIn (de prueba, pero con la estructura de datos personales).
- El PDF del informe también es público.

**M2. Dependencias sin uso:** `@google/genai`, `express`, `dotenv`, `motion` (y `@types/express`, `tsx`, `autoprefixer`, que no son necesarias para la app). Aumentan la superficie de ataque y el tamaño de la instalación.

**M3. TypeScript laxo:** sin `strict`, con 59 `as any` (35 en `TabSurveysCollection.tsx`) y estados `any` en la simulación. Esconde errores de tipo; por ejemplo, las categorías del Excel no encajan en los tipos.

**M4. IDs `TIT-${n+1}` / `EMP-${n+1}`** pueden duplicarse tras importar o reemplazar, lo que genera claves React duplicadas.

**M5. El parser mapea la edad "25-34 años" a "27 - 30 años"** ([csvParser.ts:100](src/utils/csvParser.ts#L100)) y detecta el área "IA" con `includes('ia')`, que es frágil ("Ciencia de datos" daría IA).

**M6. Se muestra `$\chi^2$` literal** (LaTeX sin renderizar) en [TabSurveysCollection.tsx:530](src/components/TabSurveysCollection.tsx#L530).

**M7. Los nombres de dimensión no coinciden** entre `AFIRMACIONES_EMPLEADORES` ("Confianza y calidad del perfil") y `DIMENSIONES_EMPLEADORES` ("… de egreso").

**M8. Aviso de Vite** por `__dirname` ([vite.config.ts:11](vite.config.ts#L11)). El paquete se llama `react-example` y el README es genérico, en inglés.

**M9. El histograma (Fig. 3)** tiene los conteos fijos y pinta "4-6" como consolidado aunque incluye juniors de 4 a 4.5 años.

---

## e) Plan de correcciones propuesto

| # | Paso | Detalle | Esfuerzo |
|---|---|---|---|
| 1 | **Limpieza y seguridad básica** | Quitar `@google/genai`, `express`, `dotenv`, `motion` y las referencias a Gemini en `.env.example`, `README` y `metadata`. Quitar `--host=0.0.0.0` (o documentarlo). Retirar los CSV de prueba de `public/`. Reemplazar `__dirname` por `import.meta.dirname`. Activar `strict` en `tsconfig`. README en español. | 1 h |
| 2 | **Importador real de Excel** | Agregar SheetJS (`xlsx`). Copiar la base a `data/` (o `public/data/`). Mapeo **explícito** columna → campo para las 3 hojas. Normalizar etiquetas (SI/NO, Hombre/Mujer, Likert texto → 1–4, Privado/Público, tamaños, remuneración, cargos). Reporte de errores por fila. Ajustar los tipos a las categorías reales. Cargar esta base por defecto y **eliminar `officialData.ts`**. | 5 h |
| 3 | **Módulo estadístico correcto + pruebas** | Funciones puras: descriptivos (cuartiles interpolados), frecuencias, tabla cruzada, χ² con p exacto (gamma incompleta) y valor crítico exacto, Fisher 2×2, Yates opcional, aviso de E<5, V de Cramér, índice de empleadores (Ec. 2). Pruebas unitarias (Vitest) que comprueben los valores del Excel (8.83 / 6 / 7.92, 62/83, 67.5 %, 94.9 %, 2.78/0.63, etc.). | 4 h |
| 4 | **HU1 dinámica** | Estadísticos e histograma calculados desde el estado; filtro Junior/Consolidado funcional; descriptivos por segmento. | 2 h |
| 5 | **HU2 dinámica + alerta** | Frecuencias de nivel y área calculadas; regla "top 2 > 70 %" con alerta visible, aplicada a área y a nivel. | 1.5 h |
| 6 | **HU3 desde datos** | Selector de variable de fila (nivel/área) × financiamiento; tabla observada/esperada; χ², gl, p, crítico, V, aviso de E<5 con Fisher o colapso de categorías; interpretación generada a partir del resultado. Decidir con el grupo el método oficial (sin Yates / Yates / Fisher). | 3 h |
| 7 | **HU4 dinámica + radar** | Tabla 7 calculada (n, media, DE, % acuerdo); radar SVG de las valoraciones; índices de las 4 dimensiones y barras Likert reales de los 18 ítems. | 3.5 h |
| 8 | **HU5 exportación y mapas de calor** | CSV correcto (BOM, `;`, escapado, todas las columnas) y `.xlsx` con SheetJS (hojas Titulados, Empleadores y resultados). Mapas de calor generados a partir de las tablas cruzadas. | 2.5 h |
| 9 | **Formularios** | Un solo formulario por tipo (eliminar los duplicados de `TabSurveysCollection`); campos vacíos por defecto y obligatorios; validación desempleado ≤ vida y rangos; lógica condicional coherente; opciones del diccionario real, incluido "Otro"; mostrar cargos y aspectos; IDs únicos. | 3.5 h |
| 10 | **Simulación rigurosa** | Parámetros **derivados de los datos cargados**. Eliminar `Math.random()` (semillas deterministas por réplica). Generador con período suficiente (por ejemplo m = 2³², o semillas independientes por réplica con verificación de consumo). Usar `sampleDiscrete` (transformada inversa) en todos los escenarios. IC con t-Student en A, B y C; prueba t calculada en B. Validación calculada: bondad de ajuste simulado vs. real y prueba de independencia (corridas). | 6 h |
| 11 | **Textos e informe** | Reemplazar interpretaciones y cifras fijas (portada, informe, simulación) por plantillas con los valores calculados; marcar con claridad lo que viene del informe y lo que calcula la app. | 2.5 h |
| 12 | **Verificación final** | `tsc`, `build`, pruebas, recorrido manual de cada HU con la base real y documentación de los resultados. | 1.5 h |
| | **Total estimado** | | **≈ 36 h** |

> **Orden recomendado:** 1 → 2 → 3 primero (son la base: sin datos reales ni funciones correctas, todo lo demás se rehace), después las HU 4 → 8, luego 9 y 10, y al final 11 y 12.

### Pendientes de decisión del grupo

1. Método oficial para HU3 (χ² sin corrección, Yates o Fisher), porque cambia la conclusión.
2. Si la regla de alerta del 70 % aplica al área de interés, al nivel de posgrado o a ambos.
3. Dónde vive la base: copiarla a `data/` del repo o cargarla siempre por importación. Contiene nombres de empresas, sin datos personales directos.
4. Qué hacer con el formulario duplicado de `TabSurveysCollection`: eliminarlo o dejarlo como versión rápida.

---

*No tuve la guía del docente; los requisitos se tomaron tal como están enumerados en la consigna de esta fase.*
