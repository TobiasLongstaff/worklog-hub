# Worklog Hub

**Memoria de trabajo local-first para desarrolladores que trabajan con IA.**  
Registrá pendientes, organizá tu backlog técnico, generá resúmenes diarios y conectá ChatGPT directamente con tu trabajo.

---

## Qué es Worklog Hub

Worklog Hub nació para resolver un problema concreto: los desarrolladores que trabajan intensivamente con ChatGPT, Claude Code u otros agentes acumulan pendientes en conversaciones que luego se pierden.

Un bug que se menciona de pasada, una decisión técnica que queda abierta, un refactor que un agente dice haber completado pero nadie verificó — sin un sistema que los capture y tracee, ese trabajo simplemente desaparece.

Worklog Hub captura esos pendientes, los convierte en backlog estructurado, mantiene trazabilidad entre la conversación y el trabajo real, y permite conectar ChatGPT directamente para que detecte y registre pendientes durante tus conversaciones.

Al final del día, genera un resumen automático usando OpenAI o Anthropic a partir de la actividad real del backlog, los commits de Git y los logs de agentes.

**Para quién está pensado:**
- Desarrolladores que trabajan diariamente con ChatGPT como herramienta de trabajo
- Equipos que usan agentes de código (Claude Code, OpenCode) y quieren tracear qué se pidió y qué quedó verificado
- Cualquier dev que quiera convertir las ideas que aparecen en sus conversaciones en acciones concretas

---

## Funcionalidades

### Backlog Vivo
El núcleo de la app. Una vista de todos los pendientes técnicos organizados por estado.

- Registrar bugs, deuda técnica, features futuras, validaciones pendientes, decisiones abiertas e ideas
- Estados con flujo definido: `DETECTED → ACCEPTED → ASSIGNED_TO_AGENT → IMPLEMENTED_CLAIMED → NEEDS_MANUAL_TEST → VERIFIED_DONE`
- Vista de detalle con contexto de origen, por qué importa y próximo paso sugerido
- Filtros por estado, tipo, fuente y área técnica
- KPIs del backlog siempre visibles

### Resumen Diario con IA
Genera automáticamente un resumen del día de trabajo a partir de evidencia real recopilada por la app.

- Botón en la pestaña **Resumen del día** para generar con un clic
- Contexto construido automáticamente desde:
  - Actividad del backlog del día (ítems creados, aceptados, verificados, descartados)
  - Prompts generados y tareas de agentes del día
  - Actividad de Git (commits recientes por repositorio)
  - Sesiones de Claude Code y OpenCode filtradas por fecha
- Soporta **OpenAI** (GPT-4o y otros) y **Anthropic** (Claude Sonnet, Opus, Haiku)
- Resumen renderizado con formato visual: secciones coloreadas, negritas, bullets estructurados
- Vista colapsada con las primeras 3 secciones; botón para expandir el resto
- Historial de resúmenes anteriores con navegación por fecha
- Cada resumen guarda el snapshot del contexto y del prompt para auditabilidad
- Las API keys se guardan localmente en SQLite; nunca salen del dispositivo

### Integración con ChatGPT vía MCP
Worklog Hub expone un servidor MCP local (Model Context Protocol) que permite conectar ChatGPT directamente.

- ChatGPT puede consultar pendientes existentes y crear nuevos con aprobación del usuario
- Nunca crea ítems sin confirmación explícita
- Usa ngrok con Static Domain para exponer el MCP por HTTPS con URL estable — configurás el conector una sola vez

### Detección conversacional de pendientes
Con el MCP conectado y las Project Instructions configuradas en ChatGPT:
1. ChatGPT detecta durante la conversación algo que podría ser un pendiente
2. Consulta Worklog Hub para verificar si ya existe
3. Propone registrarlo con un resumen estructurado
4. El usuario confirma (o no)
5. Se guarda en Backlog Vivo con `source=CHATGPT`

### Generación de prompts
Desde cualquier pendiente podés generar un prompt estructurado para resolverlo:
- Tipos: Implementación, Auditoría, Investigación, Estrategia
- Targets: Frontend, Backend, Fullstack
- El prompt generado se persiste y se puede copiar o enviar a un agente

### Tareas de agentes
Vínculo entre pendientes y tareas enviadas a agentes (Claude Code, OpenCode):
- Registro del comando enviado y el agente destino
- Trazabilidad del estado: Borrador → Listo → Enviado → Completado
- Historial de prompts enviados

### App desktop local-first
- Empaquetada con Tauri v2 para Windows (macOS y Linux en desarrollo)
- Todos los datos se guardan localmente en SQLite
- Sin cuenta remota, sin backend cloud, sin suscripción
- El servidor MCP y la UI arrancan juntos al abrir la app

### CLI de worklog (herramienta adicional)
Scripts para arrancar y cerrar el día de trabajo con síntesis por IA:
- `bun run worklog:start` — genera un resumen de arranque leyendo Git, memoria y logs de agentes
- `bun run worklog:end` — cierra el día con notas guardadas localmente
- `bun run commit:plan` — analiza `git diff` y propone mensajes de commit

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Runtime / servidor | [Bun](https://bun.sh) |
| Frontend | React 19 + Vite 8 + TypeScript |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| Animaciones | framer-motion |
| Base de datos | SQLite (nativo de Bun) |
| Desktop | Tauri v2 + Rust |
| Protocolo IA | MCP JSON-RPC 2.0 (spec 2025-03-26) |
| Generación de resúmenes | OpenAI API o Anthropic API (configurable) |
| Túnel HTTPS | ngrok (static domain) |

---

## Capturas

> Las capturas se incorporarán próximamente. La app incluye:
> - Dashboard con KPIs del backlog
> - Vista Backlog Vivo con filtros y detalle de pendiente
> - Resumen Diario con secciones coloreadas y formato visual
> - Integración ChatGPT / MCP con estado del túnel en tiempo real

---

## Requisitos

| Requisito | Detalle |
|---|---|
| [Bun](https://bun.sh) ≥ 1.1 | Runtime principal |
| Sistema operativo | Windows 10/11 (app desktop), cualquier OS para modo web |
| Rust + cargo | Solo si compilás la app desktop. [Instalar rustup](https://rustup.rs) |
| Visual Studio C++ Build Tools | Solo Windows, para compilar Tauri. Instalar con workload "Desktop development with C++" |
| [ngrok](https://ngrok.com) | Solo para integración con ChatGPT. Plan gratuito suficiente |
| ChatGPT con Developer Mode | Solo para usar el conector MCP |
| API key de OpenAI o Anthropic | Solo para generar resúmenes diarios con IA |

---

## Instalación y puesta en marcha

```bash
git clone https://github.com/TobiasLongstaff/worklog-hub.git
cd worklog-hub
bun install
```

### Opción A — Modo web (más rápido para probar)

Levanta el servidor backend y la UI en el navegador:

```bash
bun run dev
```

Abre `http://localhost:5173` en el navegador.

El script `dev` levanta automáticamente el servidor backend en el puerto 3131 y el frontend Vite en el 5173.

### Opción B — Modo desktop en desarrollo

Requiere Rust y las Build Tools instaladas (ver Requisitos):

```bash
bun run desktop
```

Levanta el servidor backend y abre la ventana Tauri conectada al frontend en desarrollo.

### Opción C — Build de producción (app instalable)

Requiere Rust, cargo y las C++ Build Tools instaladas (ver Requisitos).

```bash
bun run desktop:build
```

Ese comando hace en secuencia:
1. `vite build` → compila el frontend React a `dist/`
2. `bun run build:server:win` → compila el servidor Bun a un `.exe` standalone (sin necesitar Bun instalado)
3. `tauri build` → empaqueta todo en un installer NSIS

El instalador queda en `src-tauri/target/release/bundle/nsis/`.

Para otras plataformas, primero compilá el servidor y luego corré `tauri build`:
```bash
bun run build:server:mac-arm   # macOS Apple Silicon
bun run build:server:mac-x64   # macOS Intel
bun run build:server:linux     # Linux x64
```

---

## Datos en producción, primer arranque y updates

### Separación de datos e instalación

La app instalada separa por diseño el directorio de la aplicación del directorio de datos del usuario:

```
C:\Program Files\Worklog Hub\   ← binarios de la app (se reemplazan en cada update)
C:\Users\{usuario}\AppData\Roaming\com.workloghub.dev\
    ├── worklog.config.json     ← configuración de proyectos (creada en primer arranque)
    └── data\
        └── worklog-hub.sqlite  ← todos tus datos (nunca se toca en un update)
```

### Primer arranque

Al abrir la app por primera vez, Worklog Hub crea automáticamente el directorio de datos y genera un `worklog.config.json` de plantilla con instrucciones. Editalo para apuntar a tus proyectos.

### Updates

Instalar una nueva versión encima de la anterior es seguro: el installer solo reemplaza los archivos en `Program Files`. Los datos en `AppData` nunca se tocan. Al abrir la nueva versión, las migraciones de schema de SQLite se aplican automáticamente si hay cambios.

Flujo completo de un update:

```bash
# 1. Hacés cambios en el código
# 2. Buildás
bun run desktop:build
# 3. Instalás el nuevo .exe encima del anterior
# → los datos del usuario en AppData se preservan intactos
```

### Migrar datos del entorno de desarrollo a la app instalada

Si venías usando la app en modo dev y querés mover tus datos al instalado:

1. Asegurate de que el servidor dev **no esté corriendo**
2. Copiá los archivos SQLite al directorio de datos de la app instalada:

```powershell
$src = "C:\ruta\al\repositorio\data"
$dst = "$env:APPDATA\com.workloghub.dev\data"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item "$src\worklog-hub.sqlite"     "$dst\worklog-hub.sqlite"     -Force
Copy-Item "$src\worklog-hub.sqlite-wal" "$dst\worklog-hub.sqlite-wal" -Force
Remove-Item "$dst\worklog-hub.sqlite-shm" -ErrorAction SilentlyContinue
```

3. Abrí la app — SQLite aplica el WAL automáticamente y todos los datos aparecen.

### Datos de ejemplo

Para poblar la base con ítems de prueba:

```bash
bun run backlog:seed
```

Solo funciona con la base vacía. No sobreescribe datos existentes.

### Resetear la base de datos

```bash
# Windows
del data\worklog-hub.sqlite
bun run backlog

# macOS/Linux
rm data/worklog-hub.sqlite
bun run backlog
```

---

## Primer uso

1. Abrí Worklog Hub (`bun run dev` o la app desktop).
2. Explorá el **Inbox — Detectados** para ver los pendientes sin revisar.
3. Hacé clic en un ítem para abrir el panel de detalle.
4. Usá las acciones rápidas para aceptar, descartar o cambiar el estado.
5. Para crear un pendiente manualmente, usá el botón **+** en la barra superior.
6. Si querés generar resúmenes diarios con IA, navegá a **Ajustes → Configuración de IA**.
7. Si querés conectar ChatGPT, navegá a **Integración ChatGPT / MCP** en el sidebar.

---

## Configurar Resumen Diario con IA

La pestaña **Resumen del día** genera un resumen automático a partir de la actividad real del día. Para habilitarla necesitás una API key de OpenAI o Anthropic.

### Paso 1 — Configurar la API key

Con la app abierta, navegá a **Ajustes → Integración ChatGPT / MCP** y bajá hasta la sección **Configuración de IA — Resumen diario**:

1. Seleccioná el proveedor: **OpenAI** o **Anthropic**
2. Pegá tu API key
3. Seleccioná el modelo (se puede dejar el valor por defecto)
4. Hacé clic en **Guardar configuración de IA**

Las keys se guardan localmente en SQLite. No se envían a ningún servidor propio.

### Paso 2 — Generar el resumen del día

1. Navegá a **Resúmenes → Resumen del día** en el sidebar
2. Hacé clic en **Generar resumen diario**
3. La app construye el contexto automáticamente (backlog, Git, agentes) y llama a la IA
4. El resumen se guarda y queda disponible en el historial

### Configurar colectores de Git y agentes (opcional)

Para que el resumen incluya actividad de Git, Claude Code y OpenCode, creá `worklog.config.json` en la raíz del repositorio:

```json
{
  "projects": [
    { "name": "mi-frontend", "path": "C:/ruta/al/frontend" },
    { "name": "mi-backend", "path": "C:/ruta/al/backend" }
  ],
  "agentLogs": {
    "claudeCode": "C:/Users/usuario/.claude/projects",
    "openCode": "C:/Users/usuario/.opencode/sessions"
  },
  "daysToScan": 7,
  "maxAgentSessions": 10
}
```

Si el archivo no existe, el resumen se genera igualmente usando solo los datos del backlog.

---

## Configurar integración con ChatGPT

Para la experiencia completa necesitás **dos cosas**:

| Componente | Para qué sirve |
|---|---|
| Conector MCP | ChatGPT tiene herramientas para leer y escribir en Worklog Hub |
| Project Instructions | ChatGPT sabe cuándo y cómo detectar pendientes de forma activa |

Solo conectar el MCP **no activa** la detección automática. Necesitás ambos.

### Paso 1 — Crear cuenta en ngrok

Registrate gratis en [ngrok.com](https://ngrok.com). El plan gratuito incluye un Static Domain (dominio estable).

### Paso 2 — Obtener Authtoken y Static Domain

Desde tu panel de ngrok:
- **Authtoken**: en *Your Authtoken*
- **Static Domain**: en *Cloud Edge → Domains* — tiene la forma `algo-random.ngrok-free.app`

### Paso 3 — Instalar ngrok

Descargá ngrok desde [ngrok.com/download](https://ngrok.com/download).

En Windows también podés instalarlo desde la **Microsoft Store** — Worklog Hub lo detecta automáticamente.

### Paso 4 — Configurar ngrok en Worklog Hub

Con la app abierta, navegá a **Integración ChatGPT / MCP** en el sidebar y completá:
- **Token de autenticación**: pegá el Authtoken de ngrok
- **Dominio estático**: pegá solo el hostname (`algo-random.ngrok-free.app`, sin `https://`)
- Opcionalmente activá **"Activar automáticamente al abrir"**

Hacé clic en **Guardar y activar túnel**.

### Paso 5 — Copiar la URL MCP

Una vez que el túnel esté activo, Worklog Hub mostrará la URL pública. Copiala con el botón **Copiar URL MCP**.

Tiene la forma: `https://algo-random.ngrok-free.app/mcp`

### Paso 6 — Crear el conector en ChatGPT

1. En ChatGPT → **Settings** → **Apps & Connectors**
2. **Advanced settings** → **Developer mode** → **Create connector**
3. Pegá la URL MCP que copiaste
4. Guardá

El conector se configura una sola vez. La URL no cambia entre sesiones gracias al Static Domain.

### Paso 7 — Pegar las Project Instructions

En ChatGPT, abrí el Project donde trabajás:
1. Menú de tres puntos del Project → **Project settings**
2. En **Project Instructions**, pegá el bloque que encontrás en la sección **"Paso final: enseñarle a ChatGPT cuándo registrar pendientes"** dentro de la app

Las instrucciones aplican a todos los chats de ese Project. Podés adaptarlas para distintos proyectos.

### Paso 8 — Probar la integración

Con Worklog Hub abierto y el túnel activo, pegá este mensaje en un chat del Project con la app Worklog Hub activada:

```
Estoy probando la integración de Worklog Hub. Durante esta conversación, detectá si este asunto debe registrarse como pendiente y proponeme cargarlo si corresponde:

"Revisar que la pantalla de configuración de integraciones muestre un error claro cuando ngrok no logra iniciar correctamente".
```

**Resultado esperado:**
1. ChatGPT detecta que es un pendiente
2. Consulta Worklog Hub para ver si ya existe
3. Propone registrarlo con título, tipo y módulo
4. Confirmás con "sí"
5. El ítem aparece en Backlog Vivo → Detectados con `source=CHATGPT`

---

## Project Instructions recomendadas

Pegá este bloque en las Project Instructions del Project de ChatGPT donde trabajás:

```
Cuando trabajemos sobre este proyecto, actuá también como detector de pendientes conversacionales.

Cada vez que durante la conversación aparezca algo que:
- queda sin cerrar,
- se pospone,
- se menciona como bug, deuda técnica o mejora futura,
- se implementa pero no queda probado,
- queda ambiguo,
- requiere validación posterior,
- o podría olvidarse al avanzar con otro tema,

debes evaluar si corresponde registrarlo en Worklog Hub.

Antes de proponer crear un nuevo pendiente:
1. Consultá Worklog Hub para verificar si ya existe uno equivalente o muy similar.
2. Si ya existe y sigue abierto, avisá que ese pendiente ya está registrado.
3. Si existe pero está marcado como verificado o descartado, avisá que podría tratarse de una regresión, un caso distinto o algo ya resuelto.
4. Si no existe, proponé crear un nuevo pendiente en Worklog Hub.

No crees pendientes sin confirmación explícita del usuario.

Cuando propongas uno nuevo, resumilo con:
- título,
- tipo,
- módulo o área,
- por qué surgió,
- por qué importa,
- próximo paso sugerido.

Si el usuario confirma, usá la herramienta de Worklog Hub para registrarlo.

Worklog Hub es la fuente de verdad del estado de los pendientes. No dependas solo de memoria interna para saber si algo sigue abierto, fue descartado o ya se verificó.

Si la herramienta de Worklog Hub no está disponible en el chat, avisá brevemente que no podés consultar ni registrar pendientes en ese momento y seguí ayudando con la conversación normalmente.
```

---

## Herramientas MCP disponibles

| Herramienta | Tipo | Descripción |
|---|---|---|
| `create_backlog_item` | Escritura | Crea un pendiente (siempre `source=CHATGPT`, `status=DETECTED`) |
| `list_backlog_items` | Lectura | Lista con filtros por estado, tipo, módulo, búsqueda libre |
| `get_backlog_item` | Lectura | Detalle completo por ID |
| `update_backlog_item_status` | Escritura | Transiciona el estado con validación de reglas de negocio |

El MCP implementa el protocolo JSON-RPC 2.0 (MCP spec 2025-03-26, Streamable HTTP transport) en `POST /mcp`.

---

## Cómo usar Worklog Hub en la práctica

### Caso 1 — Generar el resumen del día
```
1. Navegá a Resúmenes → Resumen del día
2. Hacé clic en "Generar resumen diario"
3. La IA analiza el backlog del día, commits y sesiones de agentes
4. El resumen se guarda con secciones: avances, agentes, pendientes, qué retomar mañana
5. Copialo al portapapeles o regenerá si el contexto cambió
```

### Caso 2 — Registrar un bug desde ChatGPT
```
Usuario: "Encontré que el filtro de cheques no trae todos los registros cuando hay más de 100."

ChatGPT: Detecté un bug: "Filtro de cheques no muestra todos los registros con más de 100 ítems".
         ¿Lo registro en Worklog Hub?

Usuario: Sí, módulo Cheques, área Frontend.

ChatGPT: [llama create_backlog_item]
         Registrado con ID abc123 — aparece en Inbox con estado DETECTED.
```

### Caso 3 — Revisar pendientes abiertos desde ChatGPT
```
Usuario: "¿Qué bugs tengo pendientes en el módulo Cheques?"

ChatGPT: [llama list_backlog_items con type="BUG" y module="Cheques"]
         → Responde con la lista filtrada
```

### Caso 4 — Marcar una tarea como verificada
Desde la app, abrí el detalle del ítem y usá la acción **"Verificar"** — solo disponible para humanos. `VERIFIED_DONE` nunca se asigna automáticamente.

### Caso 5 — Generar prompt para resolver un bug
1. Abrí el detalle del pendiente
2. Usá la opción **Generar prompt** seleccionando tipo (Implementación, Auditoría, etc.) y target (Frontend / Backend / Fullstack)
3. El prompt generado se puede copiar o enviar a un agente

### Caso 6 — Debatir una tarea antes de implementarla
Desde el detalle del ítem, usá la opción para preparar un prompt de debate y abrirlo en el Project de ChatGPT configurado.

---

## Estructura del repositorio

```
worklog-hub/
├── scripts/
│   ├── backlog-server.ts       # Servidor principal (API REST + MCP) — bun run backlog
│   ├── backlog-seed.ts         # Datos de ejemplo — bun run backlog:seed
│   ├── dev-all.ts              # Orquestador de desarrollo — bun run dev / desktop
│   ├── worklog-start.ts        # CLI: arrancar el día — bun run worklog:start
│   ├── worklog-end.ts          # CLI: cerrar el día — bun run worklog:end
│   ├── worklog-status.ts       # CLI: estado rápido — bun run worklog:status
│   └── commit-plan.ts          # CLI: propuesta de commits — bun run commit:plan
├── src/
│   ├── App.tsx                 # Root de la SPA
│   ├── main.tsx                # Entry point React
│   ├── ai/
│   │   └── ai-client.ts        # Cliente dual OpenAI / Anthropic
│   ├── collectors/
│   │   ├── git-collector.ts    # Actividad Git por proyecto
│   │   ├── claude-code-collector.ts
│   │   └── opencode-collector.ts
│   ├── backlog/
│   │   ├── domain/types.ts     # Tipos de dominio (BacklogItem, DailySummary, etc.)
│   │   ├── db/                 # SQLite: conexión y migraciones (V1–V5)
│   │   ├── repository/         # Acceso a datos (backlog, prompts, settings, resúmenes)
│   │   ├── service/
│   │   │   ├── backlog-service.ts              # Reglas de negocio y transiciones de estado
│   │   │   ├── daily-summary-generator-service.ts  # Orquesta contexto + IA + persistencia
│   │   │   └── ngrok-tunnel-service.ts         # Gestión del proceso ngrok
│   │   ├── api/
│   │   │   ├── handlers.ts                     # REST backlog
│   │   │   ├── daily-summary-handlers.ts       # REST resúmenes diarios + generación con IA
│   │   │   └── settings-handlers.ts            # REST settings (ngrok + IA)
│   │   └── mcp/handler.ts      # Servidor MCP JSON-RPC 2.0
│   ├── components/
│   │   ├── backlog/            # ItemCard, ItemList, DetailPanel, KpiBar, FilterBar
│   │   ├── daily/
│   │   │   ├── DailySummarySection.tsx  # Vista principal del resumen diario
│   │   │   └── MarkdownContent.tsx      # Renderer Markdown liviano para resúmenes
│   │   ├── settings/           # ChatGptSettings (ngrok + configuración de IA)
│   │   ├── agents/             # AgentTasksSection
│   │   ├── prompts/            # PromptSection
│   │   ├── modals/             # CreateItem, AddEvidence, Dispatch, etc.
│   │   ├── layout/             # Sidebar, Topbar
│   │   ├── shared/             # FadeIn, MetricCard, AnimatedList, EmptyState, etc.
│   │   └── ui/                 # shadcn/ui components
│   ├── lib/
│   │   ├── api.ts              # Cliente HTTP (API, SettingsAPI, DailySummaryAPI, AISettingsAPI)
│   │   ├── types.ts            # Tipos TypeScript del frontend
│   │   └── constants.ts        # Labels, mapeos de estado, TAB_CONFIG
│   └── hooks/
│       └── useTheme.ts         # Toggle dark/light mode
├── src-tauri/
│   ├── tauri.conf.json         # Configuración Tauri (productName, bundler, sidecar)
│   ├── Cargo.toml              # Dependencias Rust
│   ├── src/lib.rs              # Setup Tauri: arranca el sidecar del servidor
│   └── binaries/               # Ejecutables compilados (en .gitignore)
├── data/
│   └── worklog-hub.sqlite      # Base SQLite (auto-creada, en .gitignore)
├── worklog.config.json         # Rutas de proyectos y logs de agentes (en .gitignore)
└── memory/                     # Notas y contexto del CLI de worklog (local)
```

### Migraciones de base de datos

Las migraciones se aplican automáticamente al arrancar el servidor:

| Versión | Cambios |
|---|---|
| V1 | Tablas base: `backlog_items`, `backlog_evidence`, `backlog_prompts`, `agent_tasks` |
| V2 | Tabla `daily_summaries` para resúmenes del día |
| V3 | Tabla `integration_settings` para config de ngrok y otras integraciones |
| V4 | Columnas `accepted_at`, `verified_at`, `discarded_at`, `reopened_at` en `backlog_items` |
| V5 | Columnas `model`, `context_snapshot_json`, `prompt_snapshot` en `daily_summaries` |

---

## Persistencia y privacidad

- **Base de datos**: SQLite en `data/worklog-hub.sqlite`, creada automáticamente al arrancar. No se versiona (está en `.gitignore`).
- **Sin cuenta remota**: Worklog Hub no requiere autenticación propia ni envía datos a ningún servidor externo.
- **ngrok authtoken**: se guarda localmente en SQLite. Nunca se loguea completo ni se envía fuera del dispositivo.
- **API keys de IA (OpenAI / Anthropic)**: se guardan localmente en SQLite. Nunca se loguean ni se muestran en claro. Si se usa la función de Resumen Diario, el contenido del backlog del día se envía a los servidores de OpenAI o Anthropic para generar el resumen.
- **ngrok**: si está activo, el tráfico de la API MCP pasa por los servidores de ngrok hacia ChatGPT. El contenido de los pendientes es visible para ngrok en tránsito.
- **CLI de worklog**: los scripts `worklog:start` y `worklog:end` pueden enviar resúmenes de sesiones de agentes a una API de IA si se configura una en `.env`. Esto es opcional y configurable.

---

## Estado del proyecto

| Módulo | Estado |
|---|---|
| Backlog Vivo (CRUD, estados, filtros, detalle) | Funcional |
| Servidor MCP y herramientas | Funcional |
| Integración ngrok con Static Domain | Funcional |
| Resumen Diario con IA (OpenAI + Anthropic) | Funcional |
| App web (`bun run dev`) | Funcional |
| App desktop Windows (`bun run desktop`) | Funcional |
| Build/instalador Windows (`bun run desktop:build`) | Funcional — datos en AppData, updates sin pérdida de datos |
| Build macOS / Linux | En evolución — scripts disponibles, no probado extensivamente |
| CLI de worklog (start/end/status) | Funcional — feature separada del Backlog Vivo |
| Reconciliación automática con commits/agentes | Diseñado, no implementado |
| Releases descargables | Pendiente |

---

## Roadmap

- Releases descargables (`.exe`, `.dmg`) publicados en GitHub Releases
- Soporte macOS y Linux verificado y documentado
- Reconciliación automática: analizar commits y sesiones de agentes para actualizar estados de pendientes
- Streaming del resumen diario (ver el texto generarse en tiempo real)
- Importar/exportar backlog
- Múltiples proyectos con vistas separadas
- Historial de cambios por ítem

---

## Contribuir

Las contribuciones son bienvenidas — bugs, features, documentación, mejoras de UX, compatibilidad con macOS/Linux o tests automatizados.

Leé [CONTRIBUTING.md](./CONTRIBUTING.md) para setup local, convenciones de código y el flujo completo.

---

## Seguridad

Si encontrás una vulnerabilidad, **no abras un Issue público** — escribí a tobiaslongstaff@gmail.com. Ver [SECURITY.md](./SECURITY.md) para el proceso completo.

---

## Licencia

Apache 2.0 — ver [LICENSE](./LICENSE).  
Copyright 2026 Tobias Longstaff.

---

## Soporte

- **Bugs y sugerencias**: abrí un [Issue](../../issues) en GitHub
- **Preguntas sobre la integración ChatGPT/MCP**: la sección **Integración ChatGPT / MCP** dentro de la app tiene una guía paso a paso completa con prueba final incluida
