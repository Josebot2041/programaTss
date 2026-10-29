# Simulador de Mercado y Acreditación ARCU-SUR – Ingeniería de Sistemas (UMSS)

Herramienta web de recolección, análisis estadístico y simulación estocástica sobre titulados y
empleadores de la Carrera de Ingeniería de Sistemas, para la materia **Taller de Simulación de
Sistemas** (enfoque de acreditación ARCU-SUR).

La interfaz (React) lee los datos de una API propia (Express) conectada a PostgreSQL. Para usarla hay
que iniciar sesión con una cuenta (CI y contraseña); los administradores tienen además una sección de
**Administración** con el panel de control, la gestión de usuarios y las tablas completas. Si con la
sesión iniciada la API deja de responder, la aplicación usa como respaldo el Excel incluido en
`public/data/` y lo indica con un aviso.

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

   Para comprobar la carga (148 titulados, 51 empleadores, datos idénticos al Excel y los mismos
   valores de control del informe):

   ```bash
   npm run db:verificar
   ```

6. **Crear el primer administrador.** La web no trae cuentas ni contraseñas predefinidas, y el
   formulario «Crear cuenta» siempre crea usuarios normales. El primer administrador se crea desde
   la consola:

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

- `npm run test` corre las pruebas de Vitest. Las de la API (`server/auth.test.ts`) usan la base de
  `.env`: crean usuarios de prueba (CI que empiezan con 95) y los borran al terminar. Si no hay
  base, se omiten con un aviso.
- `npm run test:e2e` corre `tests/arcusur.spec.ts` con Playwright. Levanta la API en el puerto 4000
  y el frontend en el 3100 (o reutiliza los que ya estén en marcha) y usa usuarios de prueba (CI
  94…) que se borran al terminar. La primera vez instale el navegador con
  `npx playwright install chromium`.

## API

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/health` | Público | Estado de la API y de la conexión a la base (`503` si la base no responde) |
| POST | `/api/auth/registro` | Público | Crea una cuenta con rol `usuario` e inicia sesión (`201`, `400` con `{ errores }`, `409` si el CI ya existe) |
| POST | `/api/auth/login` | Público | Inicia sesión con `{ ci, password }` (`401` «CI o contraseña incorrectos», `429` tras 5 intentos fallidos) |
| POST | `/api/auth/logout` | Público | Cierra la sesión |
| GET | `/api/auth/yo` | Sesión | Usuario actual (sin el hash de la contraseña) |
| GET | `/api/titulados` | Sesión | Lista de titulados |
| POST | `/api/titulados` | Sesión | Registra una encuesta de titulado (`201`, o `400` con `{ errores }` por campo) |
| GET | `/api/empleadores` | Sesión | Lista de empleadores |
| POST | `/api/empleadores` | Sesión | Registra una encuesta de empleador (`201`, o `400` con `{ errores }` por campo) |
| GET | `/api/items-empleadores` | Sesión | Textos de las 18 afirmaciones de empleadores |
| GET | `/api/admin/usuarios` | Admin | Usuarios, con `?buscar=` (nombre o CI), `?pagina=` y `?por_pagina=` (hasta 100) |
| PATCH | `/api/admin/usuarios/:id` | Admin | Cambia `{ activo, rol }`. Un administrador no puede desactivarse ni quitarse el rol |
| DELETE | `/api/admin/usuarios/:id` | Admin | Elimina una cuenta y sus sesiones (no la propia) |
| GET | `/api/admin/resumen` | Admin | Totales de usuarios y encuestas (base oficial vs. formularios) y registros de los últimos 7 días |

Sin sesión, las rutas protegidas responden `401`; las de administración con un usuario normal, `403`.

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
  respuesta tarda lo mismo en ambos casos. Tras 5 intentos fallidos con el mismo CI desde la misma IP
  hay que esperar 15 minutos (el contador vive en la memoria del proceso de la API).
- **Roles:** `usuario` ve toda la web actual; `admin` además ve la sección **Administración**. Un
  usuario normal que abre `#admin` ve «No tiene permisos…» y vuelve a la portada.

## Stack

React 19 · TypeScript (modo `strict`) · Vite · Tailwind CSS · lucide-react · Express 5 · PostgreSQL (pg)

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/components/` | Pestañas de la interfaz (análisis HU1–HU5, simulación, encuestas, plan estratégico), pantalla de acceso y `admin/` (panel de control, usuarios, dashboard) |
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

Los manejadores de `server/handlers/` reciben `{ body, params, query, usuario }` y devuelven
`{ status, body }` (y, en login y logout, qué hacer con la sesión), sin depender de Express. Para
pasarlos a funciones serverless basta con un archivo por ruta, por ejemplo `api/titulados.ts`.
`despachar` no comprueba el acceso: cada ruta declara el suyo en `RUTAS` (`publico`, `sesion` o
`admin`) y en serverless hay que aplicar antes el equivalente de `requiereSesion` / `requiereAdmin`
(por ejemplo, con el mismo `express-session`):

```ts
import { RUTAS, despachar } from '../server/handlers';

export default async function handler(req, res) {
  const { status, body } = await despachar(RUTAS['/api/titulados'], req.method, { body: req.body });
  res.status(status).json(body);
}
```

El relevamiento técnico inicial y el plan de correcciones están en [RELEVAMIENTO.md](RELEVAMIENTO.md).
