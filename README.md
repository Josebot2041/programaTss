# Simulador de Mercado y Acreditación ARCU-SUR – Ingeniería de Sistemas (UMSS)

Herramienta web de recolección, análisis estadístico y simulación estocástica sobre titulados y
empleadores de la Carrera de Ingeniería de Sistemas, para la materia **Taller de Simulación de
Sistemas** (enfoque de acreditación ARCU-SUR).

La interfaz (React) lee los datos de una API propia (Express) conectada a PostgreSQL. Si la API no
responde, la aplicación usa como respaldo el Excel incluido en `public/data/` y lo indica con un aviso.

## Requisitos

- Node.js 22.12 o superior
- PostgreSQL local (probado en `localhost:5432`) con una base llamada `programatss`

## Instalación

1. **Instalar las dependencias**

   ```bash
   npm install
   ```

2. **Crear la base de datos** (si todavía no existe), por ejemplo con psql o pgAdmin:

   ```sql
   CREATE DATABASE programatss;
   ```

3. **Configurar la conexión.** Copie `.env.example` como `.env` y escriba la contraseña de su
   usuario de PostgreSQL:

   ```bash
   cp .env.example .env
   ```

   ```env
   DATABASE_URL=postgresql://postgres:SU_CONTRASEÑA@localhost:5432/programatss
   ```

   `.env` está en `.gitignore` y **nunca debe subirse al repositorio**.

4. **Crear las tablas y vistas** del esquema normalizado (`db/schema.sql`; diagrama en
   [docs/modelo_er.md](docs/modelo_er.md)):

   ```bash
   npm run db:init
   ```

   Si la base tiene el esquema anterior (sin normalizar), sus tablas se mueven al esquema
   `legacy` y el paso siguiente migra las encuestas de formularios.

5. **Cargar los catálogos y la base oficial** desde `public/data/Base_Limpia_Titulados_Empleadores.xlsx`
   (148 titulados, 51 empleadores y 18 afirmaciones):

   ```bash
   npm run db:seed
   ```

   Primero carga los catálogos desde `src/data/catalogos.ts`, luego las afirmaciones y los
   registros oficiales, todo en una transacción. Se puede ejecutar las veces que haga falta: los
   registros se identifican por su id de la base oficial, así que no se duplican, y las encuestas
   cargadas desde los formularios no se tocan. Si el archivo Excel no existe, el script avisa y se
   detiene sin modificar nada.

6. **Levantar la aplicación**

   ```bash
   npm run dev
   ```

   Abre el frontend en <http://localhost:3000> y la API en <http://localhost:4000/api>. Vite
   redirige `/api` al backend, así que el navegador solo usa el puerto 3000.

## Scripts

```bash
npm run dev        # frontend (Vite, :3000) + API (Express, :4000) juntos
npm run dev:web    # solo el frontend
npm run dev:api    # solo la API (se reinicia al guardar cambios)
npm run dev:red    # frontend accesible desde otros equipos de la red local
npm run db:init    # crea tablas y vistas (no borra datos; migra el esquema anterior)
npm run db:seed    # carga catálogos y actualiza la base oficial desde el Excel
npm run build      # build de producción en dist/
npm run preview    # sirve el build de producción
npm run lint       # chequeo de tipos (tsc --noEmit)
npm run test       # pruebas (vitest)
```

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado de la API y de la conexión a la base (`503` si la base no responde) |
| GET | `/api/titulados` | Lista de titulados |
| POST | `/api/titulados` | Registra una encuesta de titulado (`201`, o `400` con `{ errores }` por campo) |
| GET | `/api/empleadores` | Lista de empleadores |
| POST | `/api/empleadores` | Registra una encuesta de empleador (`201`, o `400` con `{ errores }` por campo) |
| GET | `/api/items-empleadores` | Textos de las 18 afirmaciones de empleadores |

Los POST reciben el mismo borrador que arma el formulario. El servidor comprueba que cada valor
pertenezca a su catálogo y luego aplica las mismas reglas del formulario
(`src/utils/validacion.ts`). Cada encuesta se guarda en una transacción junto con sus selecciones
múltiples y respuestas, con su `origen` (`base_oficial` o `formulario`) y su fecha de creación
(`created_at`).

## Base de datos

El esquema está normalizado (3FN): catálogos de opciones, `titulados` y `empleadores` con claves
foráneas, tablas intermedias para las preguntas de selección múltiple y `respuestas_empleador`
para las 18 afirmaciones. Las vistas `v_titulados` y `v_empleadores` devuelven el formato plano
que usan la API y los análisis. Detalles y diagrama: [docs/modelo_er.md](docs/modelo_er.md).

**Seguridad:** todas las consultas son parametrizadas (`$1`, `$2`, …); los nombres de tabla y
columna salen de constantes del código y se validan antes de usarse. Las peticiones de más de
100 KB se rechazan y los errores internos no se envían al cliente.

## Stack

React 19 · TypeScript (modo `strict`) · Vite · Tailwind CSS · lucide-react · Express 5 · PostgreSQL (pg)

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/components/` | Pestañas de la interfaz (análisis HU1–HU5, simulación, encuestas, plan estratégico) |
| `src/utils/` | Estadística, simulación, importación de datos, validación y cliente de la API (`api.ts`) |
| `src/data/` | Catálogos, afirmaciones de empleadores, diccionario de datos y plan estratégico |
| `src/types/` | Tipos de datos de titulados y empleadores |
| `server/handlers/` | Lógica de cada endpoint, independiente de Express |
| `server/` | Adaptador Express (`app.ts`), conexión (`db.ts`) y conversión filas ↔ modelo (`repositorio.ts`) |
| `server/scripts/` | Scripts `db:init` y `db:seed` |
| `db/schema.sql` | Esquema normalizado de la base de datos |
| `docs/modelo_er.md` | Diagrama entidad-relación (Mermaid) y decisiones de normalización |

### Despliegue futuro en Vercel

Los manejadores de `server/handlers/` reciben `{ body }` y devuelven `{ status, body }`, sin depender
de Express. Para pasarlos a funciones serverless basta con un archivo por ruta, por ejemplo
`api/titulados.ts`:

```ts
import { RUTAS, despachar } from '../server/handlers';

export default async function handler(req, res) {
  const { status, body } = await despachar(RUTAS['/api/titulados'], req.method, { body: req.body });
  res.status(status).json(body);
}
```

El relevamiento técnico inicial y el plan de correcciones están en [RELEVAMIENTO.md](RELEVAMIENTO.md).
