# Worklog Hub

**Memoria de trabajo local-first para desarrolladores que trabajan con IA.**  
Registrá pendientes, organizá tu backlog técnico, generá prompts y conectá ChatGPT directamente con tu trabajo.

---

## Qué es Worklog Hub

Worklog Hub nació para resolver un problema concreto: los desarrolladores que trabajan intensivamente con ChatGPT, Claude Code u otros agentes acumulan pendientes en conversaciones que luego se pierden.

Un bug que se menciona de pasada, una decisión técnica que queda abierta, un refactor que un agente dice haber completado pero nadie verificó — sin un sistema que los capture y tracee, ese trabajo simplemente desaparece.

Worklog Hub captura esos pendientes, los convierte en backlog estructurado, mantiene trazabilidad entre la conversación y el trabajo real, y permite conectar ChatGPT directamente para que detecte y registre pendientes durante tus conversaciones.

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
| Túnel HTTPS | ngrok (static domain) |

---

## Capturas

> Las capturas se incorporarán próximamente. La app incluye:
> - Dashboard con KPIs del backlog
> - Vista Backlog Vivo con filtros y detalle de pendiente
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

---

## Instalación y puesta en marcha

```bash
git clone https://github.com/tu-usuario/worklog-hub.git
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

```bash
# 1. Compilar el servidor como binario nativo (Windows)
bun run build:server:win

# 2. Build completo: frontend + servidor + empaquetado Tauri
bun run desktop:build
```

El instalador queda en `src-tauri/target/release/bundle/`.

Para otras plataformas, reemplazá el paso 1:
```bash
bun run build:server:mac-arm   # macOS Apple Silicon
bun run build:server:mac-x64   # macOS Intel
bun run build:server:linux     # Linux x64
```

> **Nota:** No hay releases descargables disponibles todavía. Por ahora la app se ejecuta desde el repositorio. Los instaladores se incorporarán más adelante.

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
6. Si querés conectar ChatGPT, navegá a **Integración ChatGPT / MCP** en el sidebar.

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

### Caso 1 — Registrar un bug desde ChatGPT
```
Usuario: "Encontré que el filtro de cheques no trae todos los registros cuando hay más de 100."

ChatGPT: Detecté un bug: "Filtro de cheques no muestra todos los registros con más de 100 ítems".
         ¿Lo registro en Worklog Hub?

Usuario: Sí, módulo Cheques, área Frontend.

ChatGPT: [llama create_backlog_item]
         Registrado con ID abc123 — aparece en Inbox con estado DETECTED.
```

### Caso 2 — Revisar pendientes abiertos desde ChatGPT
```
Usuario: "¿Qué bugs tengo pendientes en el módulo Cheques?"

ChatGPT: [llama list_backlog_items con type="BUG" y module="Cheques"]
         → Responde con la lista filtrada
```

### Caso 3 — Marcar una tarea como verificada
Desde la app, abrí el detalle del ítem y usá la acción **"Verificar"** — solo disponible para humanos. `VERIFIED_DONE` nunca se asigna automáticamente.

### Caso 4 — Generar prompt para resolver un bug
1. Abrí el detalle del pendiente
2. Usá la opción **Generar prompt** seleccionando tipo (Implementación, Auditoría, etc.) y target (Frontend / Backend / Fullstack)
3. El prompt generado se puede copiar o enviar a un agente

### Caso 5 — Debatir una tarea antes de implementarla
Desde el detalle del ítem, usá la opción para preparar un prompt de debate y abrirlo en el Project de ChatGPT configurado.

---

## Estructura del repositorio

```
worklog-hub/
├── scripts/
│   ├── backlog-server.ts     # Servidor principal (API REST + MCP) — bun run backlog
│   ├── backlog-seed.ts       # Datos de ejemplo — bun run backlog:seed
│   ├── dev-all.ts            # Orquestador de desarrollo — bun run dev / desktop
│   ├── worklog-start.ts      # CLI: arrancar el día — bun run worklog:start
│   ├── worklog-end.ts        # CLI: cerrar el día — bun run worklog:end
│   ├── worklog-status.ts     # CLI: estado rápido — bun run worklog:status
│   └── commit-plan.ts        # CLI: propuesta de commits — bun run commit:plan
├── src/
│   ├── App.tsx               # Root de la SPA
│   ├── main.tsx              # Entry point React
│   ├── backlog/
│   │   ├── domain/types.ts   # Tipos de dominio
│   │   ├── db/               # SQLite: conexión y migraciones
│   │   ├── repository/       # Acceso a datos
│   │   ├── service/          # Lógica de negocio y reglas de estado
│   │   ├── api/              # Handlers HTTP (REST + settings + ngrok)
│   │   └── mcp/              # Servidor MCP (JSON-RPC 2.0)
│   ├── components/
│   │   ├── backlog/          # ItemCard, ItemList, DetailPanel, KpiBar, FilterBar
│   │   ├── settings/         # ChatGptSettings, NgrokStatusPanel
│   │   ├── agents/           # AgentTasksSection
│   │   ├── prompts/          # PromptSection
│   │   ├── modals/           # CreateItem, AddEvidence, Dispatch, etc.
│   │   ├── layout/           # Sidebar, Topbar
│   │   ├── shared/           # FadeIn, MetricCard, AnimatedList, etc.
│   │   └── ui/               # shadcn/ui components
│   ├── lib/
│   │   ├── api.ts            # Cliente HTTP hacia el servidor
│   │   ├── types.ts          # Tipos TypeScript del frontend
│   │   └── constants.ts      # Labels, mapeos de estado, TAB_CONFIG
│   └── hooks/
│       └── useTheme.ts       # Toggle dark/light mode
├── src-tauri/
│   ├── tauri.conf.json       # Configuración Tauri (productName, bundler, sidecar)
│   ├── Cargo.toml            # Dependencias Rust
│   ├── src/lib.rs            # Setup Tauri: arranca el sidecar del servidor
│   └── binaries/             # Ejecutables compilados (en .gitignore)
├── data/
│   └── worklog-hub.sqlite    # Base SQLite (auto-creada, en .gitignore)
└── memory/                   # Notas y contexto del CLI de worklog (local)
```

---

## Persistencia y privacidad

- **Base de datos**: SQLite en `data/worklog-hub.sqlite`, creada automáticamente al arrancar. No se versiona (está en `.gitignore`).
- **Sin cuenta remota**: Worklog Hub no requiere autenticación propia ni envía datos a ningún servidor externo.
- **ngrok authtoken**: se guarda localmente en SQLite. Nunca se loguea completo ni se envía fuera del dispositivo.
- **ngrok**: si está activo, el tráfico de la API MCP pasa por los servidores de ngrok hacia ChatGPT. El contenido de los pendientes es visible para ngrok en tránsito.
- **CLI de worklog**: los scripts `worklog:start` y `worklog:end` pueden enviar resúmenes de sesiones de agentes a una API de IA si se configura una en `.env`. Esto es opcional y configurable.

---

## Estado del proyecto

| Módulo | Estado |
|---|---|
| Backlog Vivo (CRUD, estados, filtros, detalle) | Funcional |
| Servidor MCP y herramientas | Funcional |
| Integración ngrok con Static Domain | Funcional |
| App web (`bun run dev`) | Funcional |
| App desktop Windows (`bun run desktop`) | Funcional en desarrollo |
| Build/instalador Windows | Funcional — sin release publicado |
| Build macOS / Linux | En evolución — scripts disponibles, no probado extensivamente |
| CLI de worklog (start/end/status) | Funcional — feature separada del Backlog Vivo |
| Reconciliación automática con commits/agentes | Diseñado, no implementado |
| Releases descargables | Pendiente |

---

## Roadmap

- Releases instalables (`.exe`, `.dmg`) publicados en GitHub
- Soporte macOS y Linux verificado y documentado
- Reconciliación automática: analizar commits y sesiones de agentes para actualizar estados de pendientes
- Importar/exportar backlog
- Múltiples proyectos con vistas separadas
- Historial de cambios por ítem

---

## Contribuir

Worklog Hub está pensado como una herramienta abierta. Si encontrás errores, tenés ideas para mejorar flujos, querés sumar integraciones o mejorar la documentación, las contribuciones son bienvenidas.

**Cómo contribuir:**

1. Hacé fork del repositorio
2. Creá un branch desde `main` (`git checkout -b feature/mi-mejora`)
3. Implementá el cambio
4. Abrí un Pull Request con descripción del problema que resuelve

**Áreas donde las contribuciones tienen más impacto ahora mismo:**
- Soporte y testing en macOS y Linux
- Capturas y documentación visual
- Mejoras de UX en el flujo de gestión de pendientes
- Integración con más herramientas (Linear, Notion, Jira)
- Tests automatizados

Si encontrás un bug o tenés una idea, abrí un [Issue](https://github.com/tu-usuario/worklog-hub/issues).

---

## Licencia

> Este repositorio todavía no tiene una licencia definida. Si vas a usarlo, modificarlo o redistribuirlo, tené en cuenta que sin licencia explícita aplican las restricciones de copyright por defecto. Se recomienda definir una licencia open source (MIT, Apache 2.0 o similar) antes de una publicación amplia.

---

## Soporte

- **Bugs y sugerencias**: abrí un [Issue](https://github.com/tu-usuario/worklog-hub/issues) en GitHub
- **Preguntas sobre la integración ChatGPT/MCP**: la sección **Integración ChatGPT / MCP** dentro de la app tiene una guía paso a paso completa con prueba final incluida
