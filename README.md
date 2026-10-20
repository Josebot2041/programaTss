# Simulador de Mercado y Acreditación ARCU-SUR – Ingeniería de Sistemas (UMSS)

Herramienta web de recolección, análisis estadístico y simulación estocástica sobre titulados y
empleadores de la Carrera de Ingeniería de Sistemas, para la materia **Taller de Simulación de
Sistemas** (enfoque de acreditación ARCU-SUR).

Todo se ejecuta en el navegador: no hay servidor, base de datos externa ni claves de API.

## Requisitos

- Node.js 20.11 o superior

## Ejecución

```bash
npm install
npm run dev        # http://localhost:3000 (solo este equipo)
npm run dev:red    # igual, pero accesible desde otros equipos de la red local
npm run build      # build de producción en dist/
npm run preview    # sirve el build de producción
npm run lint       # chequeo de tipos (tsc --noEmit)
```

No hace falta configurar variables de entorno (ver `.env.example`).

## Stack

React 19 · TypeScript (modo `strict`) · Vite · Tailwind CSS · lucide-react

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/components/` | Pestañas de la interfaz (análisis HU1–HU5, simulación, encuestas, plan estratégico) |
| `src/utils/` | Estadística, generador congruencial y escenarios de simulación, importación de datos |
| `src/data/` | Catálogos, afirmaciones de empleadores, diccionario de datos y plan estratégico |
| `src/types/` | Tipos de datos de titulados y empleadores |

El relevamiento técnico inicial y el plan de correcciones están en [RELEVAMIENTO.md](RELEVAMIENTO.md).
