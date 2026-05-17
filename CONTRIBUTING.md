# Contribuir a Worklog Hub

Gracias por tu interés en contribuir. Cualquier mejora, reporte de bug, propuesta de feature, mejora de documentación o corrección es bienvenida.

---

## Tipos de contribución aceptadas

- **Reportes de bugs** — encontraste algo que no funciona
- **Propuestas de features** — tenés una idea que mejoraría el proyecto
- **Documentación** — mejorar la claridad, agregar ejemplos, corregir errores
- **UX y diseño** — propuestas o implementaciones de mejoras visuales
- **Integraciones** — conectar Worklog Hub con otras herramientas
- **Compatibilidad** — testing o fixes en macOS y Linux
- **Tests** — agregar cobertura automatizada donde no existe

---

## Antes de empezar

1. Leé el [README](./README.md) para entender qué hace el proyecto y cómo funciona.
2. Revisá los [issues abiertos](../../issues) antes de abrir uno nuevo — puede que ya esté reportado o en progreso.
3. Para cambios grandes o que involucren decisiones de arquitectura, **abrí un issue primero** para discutir el enfoque antes de implementarlo.

---

## Setup local de desarrollo

### Requisitos

| Herramienta | Detalle |
|---|---|
| [Bun](https://bun.sh) ≥ 1.1 | Runtime principal |
| Node.js | Requerido por algunas herramientas dev |
| Rust + cargo | Solo para compilar la app desktop Tauri. [Instalar rustup](https://rustup.rs) |
| Visual Studio C++ Build Tools | Solo Windows, para compilar Tauri. Workload: "Desktop development with C++" |

### Clonar e instalar

```bash
git clone https://github.com/TobiasLongstaff/worklog-hub.git
cd worklog-hub
bun install
```

### Opciones de ejecución en desarrollo

```bash
# Modo web — backend + frontend en navegador (más rápido para UI)
bun run dev

# Modo desktop — backend + ventana Tauri (requiere Rust)
bun run desktop

# Solo el servidor backend (API REST + MCP, sin frontend)
bun run backlog
```

### Configuración opcional

Para usar la generación de resúmenes diarios con IA, configurá tu API key en la app: **Ajustes → Configuración de IA**.

Para conectar la integración con ChatGPT, necesitás una cuenta de ngrok (plan gratuito alcanza) y seguir los pasos en **Ajustes → Integración ChatGPT / MCP** dentro de la app.

### Datos de ejemplo

```bash
bun run backlog:seed
```

Solo funciona con la base vacía. No sobreescribe datos existentes.

---

## Estructura del proyecto

```
worklog-hub/
├── scripts/               # Entry points ejecutables (server, seed, dev)
├── src/
│   ├── backlog/           # Dominio, repositorios, servicios, API REST, MCP
│   │   ├── domain/        # Tipos de dominio (BacklogItem, AgentTask, etc.)
│   │   ├── db/            # SQLite: conexión, migraciones automáticas
│   │   ├── repository/    # Acceso a datos (patrón repository)
│   │   ├── service/       # Lógica de negocio, generador de prompts, ngrok, IA
│   │   ├── api/           # Handlers HTTP (REST)
│   │   └── mcp/           # Servidor MCP JSON-RPC 2.0
│   ├── components/        # Componentes React (backlog, daily, settings, modals...)
│   ├── config/            # Configuración (env, load-config)
│   ├── lib/               # Cliente HTTP, tipos frontend, constantes
│   └── utils/             # Utilidades compartidas
├── src-tauri/             # App desktop Tauri (Rust)
│   ├── tauri.conf.json    # Configuración de empaquetado
│   └── src/lib.rs         # Setup: arranca el sidecar del servidor
└── worklog.config.example.json  # Plantilla de configuración de proyectos
```

**Stack:**
- Backend: Bun runtime, SQLite nativo (`bun:sqlite`), cero dependencias de producción
- Frontend: React 19, Vite 8, TypeScript, Tailwind CSS v4, shadcn/ui
- Desktop: Tauri v2 + Rust
- Protocolo IA: MCP JSON-RPC 2.0

---

## Flujo de contribución

```bash
# 1. Forkear el repositorio en GitHub
# 2. Clonar tu fork
git clone https://github.com/TobiasLongstaff/worklog-hub.git
cd worklog-hub

# 3. Crear un branch desde main
git checkout -b fix/descripcion-corta
# o: feature/descripcion-corta
# o: docs/descripcion-corta

# 4. Hacer los cambios

# 5. Verificar que TypeScript compila sin errores
bunx tsc --noEmit

# 6. Probar el flujo afectado manualmente

# 7. Commit y push
git add .
git commit -m "Descripción clara de qué y por qué"
git push origin fix/descripcion-corta

# 8. Abrir Pull Request desde GitHub
```

---

## Convenciones de código

### TypeScript
- Strict mode habilitado con `noUncheckedIndexedAccess: true`
- Imports con extensión `.ts` explícita (convención Bun)
- Sin `any` salvo casos justificados
- Tipos de dominio centralizados en `src/backlog/domain/types.ts`

### Backend
- Cero dependencias de producción — solo `bun:sqlite`, `bun:ffi` y APIs nativas de Bun
- Patrón repository para acceso a datos; la lógica de negocio vive en los services
- Migraciones de schema numeradas y aditivas en `src/backlog/db/migrations.ts`
- Los handlers HTTP solo rutean y delegan; no contienen lógica de negocio

### Frontend
- Componentes en `src/components/`, agrupados por dominio
- Componentes de UI base reutilizables en `src/components/ui/` (shadcn/ui)
- Estado del server gestionado a través de `src/lib/api.ts` — no hay estado global complejo
- Tailwind CSS para estilos; evitar CSS inline salvo casos puntuales

### Commits
Mensajes claros y descriptivos en español o inglés, sin restricción de formato específico. El mensaje debe explicar **qué** cambia y **por qué**, no solo cómo.

Ejemplos:
```
fix: corregir cálculo de fechas en el filtro del backlog
feat: agregar soporte para múltiples proyectos en la misma sesión
docs: actualizar instrucciones de configuración en README
```

---

## Tests y verificación

El proyecto no tiene suite de tests automatizados todavía. Las contribuciones que agreguen tests son especialmente bienvenidas.

Por ahora, la verificación es manual:

- **TypeScript**: `bunx tsc --noEmit` — debe pasar sin errores
- **Backend**: probar los endpoints afectados con la app corriendo
- **Frontend**: verificar el flujo completo en el navegador
- **MCP**: si cambiás el handler MCP, verificar con el playground de MCP o con ChatGPT conectado
- **Desktop**: si cambiás algo de Tauri, probar con `bun run desktop`

---

## Documentación

Si tu cambio:
- agrega o modifica una feature visible → actualizá el README
- cambia la configuración o el setup → actualizá README y/o CONTRIBUTING
- cambia el schema de SQLite → agregá una migración en `migrations.ts` y actualizá la tabla de versiones en el README
- cambia el protocolo MCP → actualizá la tabla de herramientas en el README

---

## Qué no incluir en un PR

- Archivos `.env` con credenciales
- Archivos `worklog.config.json` locales
- Bases de datos SQLite (`data/*.sqlite`)
- Archivos generados (`dist/`, `src-tauri/target/`, `src-tauri/binaries/`)
- Cambios no relacionados con el foco del PR
- Logs o archivos de sesión de agentes

---

## Checklist antes de abrir un PR

- [ ] El cambio tiene foco claro — resuelve una cosa concreta
- [ ] `bunx tsc --noEmit` pasa sin errores
- [ ] Probé el flujo afectado manualmente
- [ ] Actualicé documentación si era necesario
- [ ] No incluí secretos ni datos locales
- [ ] El título y descripción del PR explican qué cambia y por qué

---

## ¿Preguntas?

Abrí un [Issue](../../issues) con la etiqueta `question` o escribí a tobiaslongstaff@gmail.com.
