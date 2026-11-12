# Simulador de Mercado y Acreditación ARCU-SUR – Ingeniería de Sistemas (UMSS)

Herramienta web de recolección, análisis estadístico y simulación estocástica sobre titulados y
empleadores de la Carrera de Ingeniería de Sistemas, para la materia **Taller de Simulación de
Sistemas** (enfoque de acreditación ARCU-SUR).

La interfaz (React) lee los datos de una API propia (Express) conectada a PostgreSQL.

| Ruta | Página |
|---|---|
| `/` | Portada pública con tres opciones: «Soy titulado», «Soy empleador» y «Administrador» |
| `/#encuesta-titulados` | Encuesta a titulados: se llena **sin cuenta** y termina con un agradecimiento |
| `/#encuesta-empleadores` | Encuesta a empleadores, también sin cuenta |
| `/#admin-login` | Acceso de administrador (CI y contraseña) |
| `/#panel/<sección>` | Panel de análisis (solo administradores; sin sesión, lleva al login y después a esa sección) |

Al abrir la portada, una encuesta o el login, la web consulta `GET /api/health` (hasta 3 s). Si
no responde como la API (por ejemplo, en un despliegue solo estático sin backend), avisa «Las
encuestas no están disponibles en este momento» y deshabilita los botones y formularios.

No hay registro público: los encuestados no necesitan cuenta y los administradores se crean con
`npm run crear-admin`. Una cuenta sin rol `admin` no puede entrar («No tiene permisos de
administrador»).

En el panel, los datos se piden a la API al entrar y al volver a la pestaña. La barra superior indica
siempre de dónde vienen: «Base de datos · N titulados» o, en naranja y con «Reintentar», «Respaldo
Excel (sin conexión)». El Excel de `public/data/` se usa solo si la API no responde o falla (5xx);
si la sesión venció (401) se vuelve al login.

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

   Complete también `SESSION_SECRET`, el secreto que firma la cookie de sesión (al menos 32
   caracteres al azar). Puede generarlo con:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   Sin `SESSION_SECRET` la API no arranca. `.env` está en `.gitignore` y **nunca debe subirse al
   repositorio**.

4. **Crear las tablas y vistas** del esquema normalizado, más las de usuarios y sesiones (`db/schema.sql`; diagrama en
   [docs/modelo_er.md](docs/modelo_er.md)):

   ```bash
   npm run db:init
   ```

   Si la base tiene el esquema anterior (sin normalizar), sus tablas se mueven al esquema
   `legacy` y el paso siguiente migra las encuestas de formularios.

5. **Cargar los catálogos y la base oficial** desde
   `public/data/Base_Limpia_Titulados_Empleadores.xlsx` (184 titulados, 78 empleadores y 18
   afirmaciones), que también usan el respaldo del frontend y las pruebas:

   ```bash
   npm run db:seed
   ```

   Esa base limpia se genera a partir de los Excel exportados de los formularios oficiales. Para
   regenerarla, copie los dos Excel en `data/encuestas/` y ejecute `npm run cargar-encuestas`: aplica
   las reglas de limpieza y deja el detalle de cada fila descartada o corregida en
   `data/encuestas/reporte_limpieza.md`. Los Excel crudos tienen datos de contacto, así que **no se
   suben al repositorio** (están en `.gitignore`); la base limpia no los incluye. El script
   `server/scripts/borrar-base-oficial.ts` elimina todos los registros oficiales: no tiene script en
   `package.json` y exige `--confirmar` y escribir «BORRAR» en la consola.

   Primero carga los catálogos desde `src/data/catalogos.ts`, luego las afirmaciones y los
   registros oficiales, todo en una transacción. Se puede ejecutar las veces que haga falta: los
   registros se identifican por su id de la base oficial, así que no se duplican, y las encuestas
   cargadas desde los formularios no se tocan. Nunca borra registros que falten en los archivos.
   Si no existe ninguno de los dos archivos, el script avisa y se detiene sin modificar nada.

   Para comprobar la carga (tantos titulados y empleadores como los archivos, datos idénticos y los
   mismos valores de control calculados desde la base o desde los archivos):

   ```bash
   npm run db:verificar
   ```

6. **Crear el primer administrador.** La web no trae cuentas ni contraseñas predefinidas ni permite
   registrarse. Los administradores se crean desde la consola:

   ```bash
   npm run crear-admin -- --ci 1234567 --nombre "Nombre Apellido"
   ```

   El script pide la contraseña dos veces sin mostrarla (al menos 8 caracteres, con una letra y un
   número). Si ya existe una cuenta con ese CI, la convierte en administrador y la activa sin tocar
   su contraseña; agregue `--restablecer-password` para cambiarla también. El CI puede llevar la
   extensión del departamento (`--ci "1234567 LP"`).

   Ejecútelo en PowerShell, CMD o la terminal de VS Code: en Git Bash (mintty) la consola no puede
   ocultar lo que se escribe y el script lee la contraseña como texto visible. Después, ese
   administrador puede promover a otros desde **Administración → Usuarios**.

7. **Levantar la aplicación**

   ```bash
   npm run dev
   ```

   Abre el frontend en <http://localhost:3000> y la API en <http://localhost:4000/api>. Vite
   redirige `/api` al backend, así que el navegador solo usa el puerto 3000 (si está ocupado, Vite
   elige el siguiente libre y lo muestra en la consola).

## Scripts

```bash
npm run dev        # frontend (Vite, :3000) + API (Express, :4000) juntos
npm run dev:web    # solo el frontend
npm run dev:api    # solo la API (se reinicia al guardar cambios)
npm run dev:red    # frontend accesible desde otros equipos de la red local
npm run db:init    # crea tablas y vistas (no borra datos; migra el esquema anterior)
npm run db:seed    # carga catálogos y actualiza la base oficial desde el Excel
npm run db:verificar # compara la base con el Excel y los valores de control
npm run crear-admin -- --ci 1234567 --nombre "Nombre Apellido"   # crea o promueve un administrador
npm run build      # build de producción en dist/
npm run preview    # sirve el build de producción
npm run lint       # chequeo de tipos (tsc --noEmit)
npm run test       # pruebas (vitest)
npm run test:e2e   # pruebas de extremo a extremo (Playwright)
```

## Pruebas

- `npm run test` corre las pruebas de Vitest. Las de la API (`server/auth.test.ts` y
  `server/importacion.test.ts`) usan la base de `.env`: crean usuarios de prueba (CI que empiezan
  con 95 y 96) y registros importados con Ids desde 990000, y los borran al terminar. Si no hay
  base, se omiten con un aviso.
- `npm run test:e2e` corre `tests/arcusur.spec.ts` con Playwright. Levanta su propia API en el
  puerto 4100 (con un límite alto de envíos de encuestas) y el frontend en el 3100 apuntando a ella
  (o reutiliza los que ya estén en marcha), y usa usuarios de prueba (CI 94…) y encuestas que se
  borran al terminar. La primera vez instale el navegador con `npx playwright install chromium`.

## API

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/health` | Público | Estado de la API y de la conexión a la base (`503` si la base no responde) |
| POST | `/api/publico/titulados` | Público | Encuesta de titulado sin cuenta (`201`, o `400` con `{ errores }` por campo; `429` tras 10 envíos por IP en una hora) |
| POST | `/api/publico/empleadores` | Público | Encuesta de empleador sin cuenta (mismas reglas y límite) |
| POST | `/api/auth/login` | Público | Inicia sesión con `{ ci, password }`, solo administradores (`401` «CI o contraseña incorrectos», `403` «No tiene permisos de administrador», `429` tras 5 intentos fallidos con el mismo CI o 20 desde la misma IP) |
| POST | `/api/auth/logout` | Público | Cierra la sesión |
| GET | `/api/auth/yo` | Sesión | Usuario actual (sin el hash de la contraseña) |
| GET | `/api/titulados` | Admin | Lista de titulados |
| POST | `/api/titulados` | Admin | Registra una encuesta de titulado desde el panel |
| GET | `/api/empleadores` | Admin | Lista de empleadores |
| POST | `/api/empleadores` | Admin | Registra una encuesta de empleador desde el panel |
| GET | `/api/items-empleadores` | Admin | Textos de las 18 afirmaciones de empleadores |
| GET | `/api/admin/usuarios` | Admin | Usuarios, con `?buscar=` (nombre o CI), `?pagina=` y `?por_pagina=` (hasta 100) |
| PATCH | `/api/admin/usuarios/:id` | Admin | Cambia `{ activo, rol }`. Un administrador no puede desactivarse ni quitarse el rol |
| DELETE | `/api/admin/usuarios/:id` | Admin | Elimina una cuenta y sus sesiones (no la propia) |
| GET | `/api/admin/resumen` | Admin | Totales de usuarios y encuestas (base oficial, formularios e importaciones) y registros de los últimos 7 días |
| POST | `/api/admin/importar/previsualizar` | Admin | Recibe un archivo (multipart, campo `archivo`, `.xlsx` o `.csv`, hasta 10 MB) y lo compara con la base **sin guardar nada**: cantidades, registros nuevos / sin cambios / que cambiarían / protegidos, problemas por fila, primeras 10 filas y un `token` vigente 15 minutos |
| POST | `/api/admin/importar/confirmar` | Admin | Guarda una previsualización con `{ token, modo }` en una sola transacción |
| GET | `/api/admin/importaciones` | Admin | Historial de importaciones (fecha, usuario, archivo, modo y cantidades) |

Sin sesión, las rutas protegidas responden `401`; con la sesión de una cuenta que perdió el rol de
administrador, `403`.

Las encuestas públicas llevan un campo trampa oculto (`sitio_web`): si llega lleno, la API responde
como si hubiera guardado, pero no guarda nada. El límite de 10 envíos por IP y por hora (variable
`LIMITE_ENCUESTAS_POR_HORA`) cuenta cada encuesta por separado y vive en la memoria del proceso;
tenga en cuenta que detrás de un NAT (una sala de computadoras, por ejemplo) todos comparten la IP.

**Importación de archivos** (Base de datos → Importar). Acepta la base limpia (hojas Titulados,
Empleadores e Items_empleadores, o un CSV con sus columnas) y los Excel **crudos** de los formularios
oficiales (Microsoft Forms de titulados y Google Forms de empleadores), que reconoce por sus columnas
y limpia con las mismas reglas que `npm run cargar-encuestas`. Los registros se comparan por Id:

| Modo | Qué hace |
|---|---|
| `agregar` | Solo inserta los Ids nuevos; no toca los existentes |
| `actualizar` | Inserta los nuevos y reemplaza los existentes que cambian (con el mismo Id y fecha de creación) |
| `reemplazar_oficial` | Como `actualizar` y, además, quita los registros `base_oficial` que no están en el archivo (solo de las tablas que el archivo trae) |

En ningún modo se modifican ni se borran las encuestas guardadas desde la web (`origen = 'formulario'`):
si un Id del archivo es de una de ellas, se omite. Lo guardado lleva `origen = 'importacion'` y
apunta a su fila de `importaciones` (quién importó, cuándo, el archivo y el modo). Si algo falla a
mitad de camino, la transacción se deshace y no se guarda nada. Mientras esperan la confirmación,
las previsualizaciones se guardan en la tabla `importaciones_pendientes` (vencen a los 15 minutos y
las vencidas se borran), así que siguen valiendo aunque la API se reinicie. La subida del archivo es la única
ruta con un límite mayor (10 MB, con multer); el JSON de las demás sigue limitado a 100 KB.

Los POST de encuestas reciben el mismo borrador que arma el formulario. El servidor comprueba que cada valor
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

## Cuentas y sesiones

- **Contraseñas:** al menos 8 caracteres, con una letra y un número. Se guardan solo como hash
  bcrypt (costo 12) y la API nunca devuelve el hash.
- **CI:** de 5 a 10 dígitos y, opcionalmente, la extensión del departamento (LP, CB, SC, OR, PT, CH,
  TJ, BE, PD). Se guarda normalizado (`1234567 LP`), así que `1234567lp` y `1234567-LP` son el mismo CI.
- **Sesión:** se guarda en PostgreSQL (tabla `sesiones`). El navegador solo recibe una cookie
  `httpOnly` y `SameSite=Lax` (además `Secure` en producción) que vence tras 8 horas sin actividad.
  Cada petición vuelve a leer al usuario: si un administrador lo desactiva, lo elimina o le cambia el
  rol, el cambio rige de inmediato.
- **Login:** el mensaje de error es siempre «CI o contraseña incorrectos», exista o no el CI, y la
  respuesta tarda lo mismo en ambos casos. Tras 5 intentos fallidos con el mismo CI desde la misma IP,
  o 20 desde la misma IP con cualquier CI, hay que esperar 15 minutos (los contadores viven en la
  memoria del proceso de la API).
- **Roles:** solo `admin` entra al panel. La tabla `usuarios` conserva el rol `usuario` (por ejemplo,
  para quitarle el acceso a un administrador desde **Administración → Usuarios** sin borrarlo).

## Stack

React 19 · TypeScript (modo `strict`) · Vite · Tailwind CSS · lucide-react · Express 5 · PostgreSQL (pg)

SheetJS (`xlsx` 0.20.3) no se publica en el registro de npm: el paquete está guardado en
`vendor/xlsx-0.20.3.tgz` y se instala desde ahí (`"xlsx": "file:vendor/xlsx-0.20.3.tgz"`), así
`npm install` no depende de cdn.sheetjs.com.

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/components/` | Panel de análisis (`Panel.tsx`) y sus pestañas (HU1–HU5, simulación, base de datos, plan estratégico), formularios de encuesta, `publico/` (portada, encuestas públicas y acceso de administrador) y `admin/` (panel de control, usuarios, dashboard) |
| `src/rutas.ts` | Rutas de la web en el hash de la URL (portada, encuestas, login y panel) |
| `src/utils/` | Estadística, simulación, importación de datos, validación (encuestas y cuentas) y cliente de la API (`api.ts`) |
| `src/data/` | Catálogos, afirmaciones de empleadores, diccionario de datos y plan estratégico |
| `src/types/` | Tipos de datos de titulados y empleadores |
| `server/handlers/` | Lógica de cada endpoint, independiente de Express |
| `server/` | Adaptador Express (`app.ts`), conexión (`db.ts`), conversión filas ↔ modelo (`repositorio.ts`), sesiones y control de acceso (`sesion.ts`) y usuarios (`usuarios.ts`) |
| `server/scripts/` | Scripts `db:init`, `db:seed`, `db:verificar` y `crear-admin` |
| `tests/` | Pruebas de extremo a extremo con Playwright |
| `db/schema.sql` | Esquema normalizado de la base de datos |
| `docs/modelo_er.md` | Diagrama entidad-relación (Mermaid) y decisiones de normalización |

### Despliegue futuro en Vercel

Los manejadores de `server/handlers/` reciben `{ body, params, query, usuario, archivo }` y devuelven
`{ status, body }` (y, en login y logout, qué hacer con la sesión), sin depender de Express.

> **Importante:** `despachar` **no comprueba el acceso**. Cada ruta declara el suyo en `RUTAS`
> (`publico`, `sesion` o `admin`) y quien la publique debe aplicar antes `requiereSesion` /
> `requiereAdmin`. Si una función serverless llama a `despachar` sin ese control, cualquiera podría
> leer los datos o administrar usuarios.

La forma más simple y segura es publicar la misma aplicación Express en una sola función, que ya
aplica la sesión, el control de acceso de cada ruta, los límites de intentos y la subida de archivos
(por ejemplo, `api/[...ruta].ts`):

```ts
import { crearApp } from '../server/app';

export default crearApp();
```

Si prefiere una función por ruta, aplique el control antes de despachar. Por ejemplo,
`/api/titulados` tiene acceso `admin`:

```ts
import express from 'express';
import { RUTAS, despachar } from '../server/handlers';
import { crearMiddlewareSesion, requiereAdmin, requiereSesion } from '../server/sesion';

const app = express();
app.use(crearMiddlewareSesion());
// Primero la sesión y el rol; solo después el manejador
app.get('/api/titulados', requiereSesion, requiereAdmin, async (_req, res) => {
  const { status, body } = await despachar(RUTAS['/api/titulados'], 'GET', { usuario: res.locals.usuario });
  res.status(status).json(body);
});

export default app;
```

En ambos casos la función necesita `DATABASE_URL` y `SESSION_SECRET`. Si el sitio se publica sin
backend, la portada lo detecta con `/api/health` y deshabilita las encuestas y el login.

El relevamiento técnico de la versión original (documento histórico) está en [docs/RELEVAMIENTO.md](docs/RELEVAMIENTO.md).
