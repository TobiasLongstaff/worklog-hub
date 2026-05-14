# worklog-hub

CLI personal para recuperar continuidad de trabajo entre sesiones. Lee múltiples repositorios (frontend, backend) como fuentes, combina Git, memoria Markdown, sesiones de Claude Code y OpenCode, y genera un resumen de arranque con IA.

---

## 1. Qué problema resuelve

Después de varios días —especialmente tras el fin de semana— es fácil perder el hilo de:

- en qué parte del trabajo estabas
- cuál fue el último avance importante
- qué quedó pendiente
- qué deberías hacer hoy
- qué no deberías tocar para no dispersarte

Este hub lo resuelve combinando fuentes objetivas (Git) con memoria curada (Markdown) y logs de agentes IA.

---

## 2. Cómo instalar

```bash
git clone <repo> worklog-hub
cd worklog-hub
bun install
```

---

## 3. Cómo configurar `.env`

```bash
cp .env.example .env
```

Edita `.env`:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

Si no tienes API key, los comandos igual funcionan: `worklog:status` siempre, y `worklog:start` / `worklog:end` muestran la evidencia sin síntesis IA.

---

## 4. Cómo configurar `worklog.config.json`

```bash
cp worklog.config.example.json worklog.config.json
```

Edita `worklog.config.json`:

```json
{
  "language": "es",
  "memoryPath": "./memory",
  "daysToScan": 3,
  "maxAgentSessions": 5,
  "maxAgentMessagesPerSession": 20,
  "projects": [
    {
      "name": "facturacion-front",
      "path": "../facturacion-front",
      "type": "frontend"
    },
    {
      "name": "facturacion-back",
      "path": "../facturacion-back",
      "type": "backend"
    }
  ],
  "agentLogs": {
    "claudeCode": {
      "enabled": true,
      "basePath": "~/.claude/projects"
    },
    "openCode": {
      "enabled": true,
      "basePath": "~/.local/share/opencode"
    }
  }
}
```

Los `path` de proyectos son **relativos al directorio de worklog-hub** o absolutos. Se soporta `~` para el home.

Puedes declarar tantos proyectos como necesites.

---

## 5. Cómo configurar los paths de Claude Code y OpenCode

### Claude Code

Por defecto guarda sesiones en `~/.claude/projects/`. En Windows suele ser:

```
C:\Users\<usuario>\.claude\projects
```

Configura en `worklog.config.json`:

```json
"claudeCode": {
  "enabled": true,
  "basePath": "~/.claude/projects"
}
```

### OpenCode

Por defecto en Linux/macOS:

```
~/.local/share/opencode
```

En Windows puede variar. Configura el path real donde OpenCode guarda sus datos.

Si alguno de los dos no está instalado, simplemente pon `"enabled": false`.

---

## 6. Cómo correr

### Ver estado del hub (sin IA, instantáneo)

```bash
bun run worklog:status
```

Muestra: proyectos, Git, memoria, configuración IA, paths de agentes.

### Arrancar el día

```bash
bun run worklog:start
```

Recolecta todo el contexto y genera un resumen de arranque con IA (o muestra la evidencia raw si no hay IA configurada).

### Cerrar el día

```bash
bun run worklog:end
```

Te hace 5 preguntas, recolecta evidencia, genera y guarda:
- `memory/daily/YYYY-MM-DD.md` — nota del día
- `memory/current-focus.md` — estado actualizado (con backup automático)

---

## 7. Commit planning

Analiza el estado actual de Git de un proyecto y genera una propuesta de commit optimizada para continuidad de trabajo.

```bash
bun run commit:plan -- --project app-bluvoice
bun run commit:plan -- --project api-bluvoice

# alias corto
bun run commit:plan -- -p api-bluvoice
```

Este comando:
- Lee `git status` y `git diff` (staged + unstaged)
- Propone grupos de archivos para commitear
- Genera mensajes en formato Conventional Commits con sección `Worklog`
- **No ejecuta `git add`**
- **No ejecuta `git commit`**
- **No modifica ningún archivo del proyecto**

Flujo recomendado:

```bash
# 1. Revisar el plan
bun run commit:plan -- -p api-bluvoice

# 2. Stagear lo que el plan recomienda
git -C "C:/Indicum Technology/api-bluvoice" add <archivos>

# 3. Commitear con el mensaje propuesto
git -C "C:/Indicum Technology/api-bluvoice" commit
```

Variables de entorno opcionales (agregar a `.env`):

```env
MAX_DIFF_CHARS=60000      # límite de chars por diff antes de truncar
MAX_FILE_LIST_ITEMS=200   # límite de archivos en el listado
```

---

## 8. Aliases recomendados

Agrega a tu `.bashrc`, `.zshrc` o perfil de PowerShell:

**bash/zsh:**

```bash
alias ws="cd ~/dev/worklog-hub && bun run worklog:start"
alias we="cd ~/dev/worklog-hub && bun run worklog:end"
alias wstatus="cd ~/dev/worklog-hub && bun run worklog:status"
alias wcfront="cd ~/dev/worklog-hub && bun run commit:plan -- --project app-bluvoice"
alias wcback="cd ~/dev/worklog-hub && bun run commit:plan -- --project api-bluvoice"
```

**PowerShell:**

```powershell
function ws { Set-Location ~/dev/worklog-hub; bun run worklog:start }
function we { Set-Location ~/dev/worklog-hub; bun run worklog:end }
function wstatus { Set-Location ~/dev/worklog-hub; bun run worklog:status }
function wcfront { Set-Location ~/dev/worklog-hub; bun run commit:plan -- --project app-bluvoice }
function wcback { Set-Location ~/dev/worklog-hub; bun run commit:plan -- --project api-bluvoice }
```

---

---

## Backlog Vivo

Módulo web integrado en worklog-hub que centraliza todos los pendientes detectados durante conversaciones, sesiones de agentes y análisis de repositorios.

### Qué problema resuelve

Las conversaciones con ChatGPT o sesiones con agentes de código generan pendientes continuamente: bugs detectados, deuda técnica identificada, features postergadas, implementaciones que un agente dice haber completado pero que nadie verificó. Sin un sistema que los capture y traccee, esos pendientes se pierden o quedan dispersos en chats.

Backlog Vivo no es una lista de tareas. Representa la **trazabilidad** entre:
- algo que se mencionó en una conversación,
- algo que se aceptó como trabajo real,
- algo que se le pidió a un agente,
- lo que el agente dice haber implementado,
- la evidencia disponible de que fue implementado,
- la validación humana final.

### Tipos de pendiente

| Tipo | Significado |
|------|-------------|
| `BUG` | Error encontrado o reportado |
| `TECH_DEBT` | Deuda técnica identificada |
| `FEATURE` | Feature pendiente de implementar |
| `VALIDATION_PENDING` | Algo que requiere revisión o prueba |
| `OPEN_DECISION` | Decisión técnica sin tomar |
| `IMPLEMENTATION_NOT_VERIFIED` | Agente dice haberlo implementado — sin validar |
| `IDEA` | Idea mencionada, no comprometida |

### Estados y flujo

```
DETECTED → ACCEPTED → ASSIGNED_TO_AGENT → IMPLEMENTED_CLAIMED → NEEDS_MANUAL_TEST → VERIFIED_DONE
    ↓           ↓                                                                            ↑
DISCARDED   DISCARDED                                                               REOPENED ←
```

| Estado | Significado |
|--------|-------------|
| `DETECTED` | Recién detectado, sin revisar (Inbox) |
| `ACCEPTED` | Aceptado como trabajo real a hacer |
| `ASSIGNED_TO_AGENT` | Delegado a Claude Code, OpenCode u otro agente |
| `IMPLEMENTED_CLAIMED` | Un agente dice haberlo implementado |
| `IMPLEMENTED_SUSPECTED` | Hay evidencia parcial de implementación |
| `NEEDS_MANUAL_TEST` | Requiere validación manual antes de cerrar |
| `VERIFIED_DONE` | Confirmado como resuelto (solo por humano) |
| `DISCARDED` | Descartado — no aplica o quedó obsoleto |
| `REOPENED` | Reabierto tras ser cerrado o descartado |

**Regla importante:** `VERIFIED_DONE` solo puede ser asignado por humano. Nunca automáticamente.

---

### Cómo levantar el servidor

```bash
bun run backlog
```

Abre en el navegador: `http://localhost:3131`

Puerto configurable:
```bash
BACKLOG_PORT=4000 bun run backlog
```

### Datos de ejemplo (desarrollo)

```bash
bun run backlog:seed
```

Inserta 3 ítems de ejemplo. Solo funciona si la base está vacía; no sobreescribe datos existentes.

---

### Persistencia

La base de datos SQLite se crea automáticamente en:
```
data/worklog-hub.sqlite
```

El esquema se inicializa automáticamente al arrancar el servidor. No requiere configuración manual.

El directorio `data/` está en `.gitignore` para no versionar la base.

Si necesitás resetear los datos:
```bash
rm data/worklog-hub.sqlite
bun run backlog
```

---

### Integración con ChatGPT via MCP

Worklog Hub expone un servidor MCP en `POST /mcp` que permite conectar ChatGPT directamente para registrar pendientes durante conversaciones.

#### Flujo de uso

```
ChatGPT detecta un pendiente durante la conversación
           ↓
"¿Querés que lo registre en Worklog Hub?"
           ↓
Usuario confirma: "Sí"
           ↓
ChatGPT llama create_backlog_item
           ↓
Pendiente aparece en Inbox con source=CHATGPT
```

**Importante:** ChatGPT nunca debe crear ítems sin confirmación explícita del usuario. El diseño del flujo lo asume.

#### Herramientas MCP disponibles

| Herramienta | Tipo | Descripción |
|-------------|------|-------------|
| `create_backlog_item` | Escritura | Crea un pendiente (siempre `source=CHATGPT`, `status=DETECTED`) |
| `list_backlog_items` | Lectura | Lista con filtros por estado, tipo, módulo, búsqueda |
| `get_backlog_item` | Lectura | Detalle completo por ID |
| `update_backlog_item_status` | Escritura | Transiciona el estado con validación |

#### Cómo conectarlo desde ChatGPT

ChatGPT requiere que el servidor MCP sea accesible por **HTTPS**. En desarrollo local, usá un túnel:

**Opción A — Cloudflare Tunnel (recomendado):**
```bash
# En una terminal: levantás el servidor
bun run backlog

# En otra terminal: exponés por HTTPS
npx cloudflared tunnel --url http://localhost:3131
```
Cloudflared te dará una URL tipo `https://abc-xyz.trycloudflare.com`.

**Opción B — ngrok:**
```bash
npx ngrok http 3131
```

Luego en ChatGPT:
1. Abrí ChatGPT → Explorar GPTs → Crear GPT → Configurar → Acciones
2. Agregá una acción con esquema OpenAPI apuntando a tu URL del túnel
3. O si ChatGPT soporta MCP nativo: configurá el servidor MCP con la URL del túnel + `/mcp`

El endpoint MCP sigue el protocolo JSON-RPC 2.0 (MCP spec 2025-03-26, Streamable HTTP transport).

#### Ejemplo de interacción

```
Usuario: "Che, encontré que el filtro Todo de cheques no muestra todos los registros"

ChatGPT: Detecté un bug: "Filtro Todo de cheques no muestra todos los registros". 
         ¿Lo registro en tu Worklog Hub?

Usuario: Sí, en el módulo Cheques

ChatGPT: [llama create_backlog_item]
         → title: "Filtro Todo de cheques no muestra todos los registros"
         → type: "BUG"
         → module: "Cheques"

Resultado: El bug aparece en Inbox con estado DETECTED, listo para revisar.
```

```
Usuario: "¿Qué bugs tengo pendientes?"

ChatGPT: [llama list_backlog_items con type="BUG" y status="DETECTED"]
         → Responde con la lista de bugs detectados
```

---

### Motor de reconciliación (preparado, no implementado)

El modelo de datos incluye:
- Entidad `BacklogEvidence` vinculada a cada ítem
- Campos para relacionar ítems con commits (`relatedCommitId`), sesiones de agentes (`relatedAgentSessionId`) y worklogs (`relatedWorklogId`)
- Campo `confidence` (0-100) para inferencias futuras
- Estados como `IMPLEMENTED_CLAIMED`, `IMPLEMENTED_SUSPECTED` y `NEEDS_MANUAL_TEST` pensados para ser asignados automáticamente por un motor de análisis

El motor futuro podría:
1. Analizar commits recientes y sesiones de Claude Code/OpenCode
2. Buscar ítems cuyo contenido coincida con los cambios
3. Actualizar el estado sugerido a `IMPLEMENTED_SUSPECTED` o `NEEDS_MANUAL_TEST`
4. **Nunca** marcar `VERIFIED_DONE` automáticamente

---

## 8. Qué queda fuera del MVP

- **ChatGPT export/history** — no integrado todavía
- **Worktale** — no integrado
- **DevLog** — no integrado
- **UI web** — no existe ni está planeada
- **Base de datos** — no se usa ninguna; todo es Markdown + Git
- **Tableros tipo Jira/Linear** — fuera del scope intencional

---

## 9. Uso diario recomendado

| Momento | Comando | Qué hace |
|---------|---------|----------|
| Al arrancar | `ws` | Resume contexto de trabajo |
| Durante el día | editar `memory/current-focus.md` | Mantener foco actualizado |
| Al terminar | `we` | Cierra el día, genera nota |
| Rápido check | `wstatus` | Ver estado sin IA |

La memoria curada (`current-focus.md`, `backlog.md`, `decisions.md`) es la fuente más confiable. Mantenla actualizada.

---

## 10. Advertencia de privacidad

**Este sistema puede enviar resúmenes de tus sesiones de Claude Code y OpenCode a la API de IA configurada.**

- No incluyas secretos, API keys ni datos sensibles en los prompts de tus sesiones de agentes.
- Las notas Markdown se guardan localmente y no se envían a ningún servicio.
- El `.env` con tu API key nunca se loguea ni se incluye en ningún archivo generado.
- Usa `maxAgentSessions` y `maxAgentMessagesPerSession` para limitar cuánto contexto de agentes se envía.

---

## Estructura del proyecto

```
worklog-hub/
  scripts/
    worklog-start.ts     # bun run worklog:start
    worklog-end.ts       # bun run worklog:end
    worklog-status.ts    # bun run worklog:status
    commit-plan.ts       # bun run commit:plan
    backlog-server.ts    # bun run backlog  ← servidor Backlog Vivo
    backlog-seed.ts      # bun run backlog:seed  ← datos de ejemplo
  src/
    config/              # carga de .env y worklog.config.json
    collectors/          # git, memoria, Claude Code, OpenCode
    ai/                  # cliente OpenAI, prompts, tipos
    memory/              # escritura de notas y current-focus
    utils/               # exec, dates, files, logger, path
    backlog/             # módulo Backlog Vivo
      domain/types.ts    # BacklogItem, BacklogEvidence, tipos
      db/                # SQLite: conexión, migraciones, esquema
      repository/        # acceso a datos (BacklogItemRepository, BacklogEvidenceRepository)
      service/           # lógica de negocio (transiciones de estado, reglas)
      api/               # handlers HTTP REST (/api/backlog/*)
      mcp/               # servidor MCP (JSON-RPC 2.0, herramientas para ChatGPT)
  public/
    index.html           # frontend Backlog Vivo
    styles.css           # tema oscuro
    app.js               # SPA vanilla JS
  data/
    worklog-hub.sqlite   # base SQLite (creada automáticamente, en .gitignore)
  memory/
    current-focus.md     # foco actual (editado automáticamente)
    backlog.md           # pendientes a mediano plazo
    decisions.md         # decisiones técnicas
    daily/               # notas diarias YYYY-MM-DD.md
    .backup/             # backups de current-focus
```
