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
  src/
    config/              # carga de .env y worklog.config.json
    collectors/          # git, memoria, Claude Code, OpenCode
    ai/                  # cliente OpenAI, prompts, tipos
    memory/              # escritura de notas y current-focus
    utils/               # exec, dates, files, logger, path
  memory/
    current-focus.md     # foco actual (editado automáticamente)
    backlog.md           # pendientes a mediano plazo
    decisions.md         # decisiones técnicas
    daily/               # notas diarias YYYY-MM-DD.md
    .backup/             # backups de current-focus
```
