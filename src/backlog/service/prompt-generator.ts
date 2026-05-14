import type { BacklogItem, BacklogPromptTargetRepo, BacklogPromptType } from "../domain/types.ts";
import type { StackConfig } from "../../config/load-config.ts";

// ── Labels ────────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  BUG:                        "Bug / error de comportamiento",
  TECH_DEBT:                  "Deuda técnica",
  FEATURE:                    "Feature / funcionalidad nueva",
  VALIDATION_PENDING:         "Validación pendiente",
  OPEN_DECISION:              "Decisión técnica abierta",
  IMPLEMENTATION_NOT_VERIFIED:"Implementación de agente sin verificar",
  IDEA:                       "Idea / mejora potencial",
};

const REPO_LABEL: Record<BacklogPromptTargetRepo, string> = {
  FRONTEND: "Frontend",
  BACKEND:  "Backend",
  FULLSTACK:"Fullstack",
};

const PROMPT_TYPE_LABEL: Record<BacklogPromptType, string> = {
  IMPLEMENTATION: "Implementación",
  AUDIT:          "Auditoría / verificación",
  INVESTIGATION:  "Investigación técnica",
  STRATEGY:       "Estrategia / definición",
};

// ── Blocks ────────────────────────────────────────────────────────────────────

const MANDATORY_PRE_WORK = `\
## Instrucciones obligatorias antes de modificar código

1. Leé y respetá el archivo \`AGENTS.md\` o cualquier archivo de instrucciones equivalente existente en la raíz del repositorio.
2. Cargá y aplicá las skills/instrucciones específicas disponibles para este proyecto en tu sesión actual.
3. Analizá la arquitectura actual del proyecto antes de tocar código. Revisá carpetas, convenciones, patrones y cómo está resuelto algo similar ya existente.
4. No inventes patrones nuevos si ya existe una forma establecida en el proyecto. Usá lo que hay.
5. No reviertas cambios manuales previos del usuario. Si encontrás algo inesperado, mencionalo en tu entrega.
6. Mantené consistencia con el estilo, convenciones de nombres y estructura existente.
7. Eliminá código muerto o inconsistencias directamente relacionadas con esta tarea si corresponde, sin ampliar el alcance innecesariamente.`;

function buildTechInstructions(
  targetRepo: BacklogPromptTargetRepo,
  stack: StackConfig
): string {
  if (targetRepo === "FRONTEND") {
    const stackLine = stack.frontend
      ? `\n**Stack de este proyecto:** ${stack.frontend}\n`
      : "";
    return `## Instrucciones técnicas — Frontend
${stackLine}
- Revisá la arquitectura actual del frontend antes de empezar: páginas, componentes, hooks, rutas.
- Respetá las tecnologías, librerías y patrones ya presentes en el proyecto. No introduzcas dependencias nuevas sin justificación.
- Mantené consistencia con el sistema de diseño existente. No mezcles librerías de UI.
- Si la tarea toca formularios, usá las librerías de formularios ya instaladas en el proyecto.
- Si aplica validación de datos, usá el esquema de validación que ya usa el proyecto.
- No mostrés errores crudos del backend directamente al usuario. Usá mensajes descriptivos y controlados.
- No hardcodeés strings, rutas ni constantes si el proyecto ya las tiene centralizadas.
- Agregá loading states / skeletons / feedback visual apropiado cuando corresponda.
- Si la tarea involucra data fetching, respetá el cliente ya instalado (fetch nativo, React Query, SWR, Apollo, u otro).
- Revisá si hay tablas, grillas o listas similares ya implementadas y seguí el mismo patrón.`;
  }

  if (targetRepo === "BACKEND") {
    const stackLine = stack.backend
      ? `\n**Stack de este proyecto:** ${stack.backend}\n`
      : "";
    const testLine = stack.testing
      ? `- Actualizá o agregá tests si corresponde (${stack.testing}). Si no podés, explicá por qué y qué habría que testear.`
      : `- Actualizá o agregá tests si el proyecto tiene infraestructura de testing. Si no podés, explicá por qué y qué habría que testear.`;
    return `## Instrucciones técnicas — Backend
${stackLine}
- Revisá la arquitectura actual: módulos, servicios, controladores, y cómo está organizada la lógica de negocio.
- Respetá el esquema de base de datos existente. Si la tarea requiere un cambio de schema, mencionalo explícitamente antes de implementar.
- Mantené compatibilidad con los contratos de la API existentes. No rompas endpoints sin motivo.
- Cuidá transacciones y reglas de negocio: no dejés estados inconsistentes en la base de datos.
- Usá errores controlados y descriptivos. No expongas stack traces ni mensajes internos al cliente.
- Revisá si hay middlewares, guards o interceptors que apliquen a este flujo.
${testLine}`;
  }

  // FULLSTACK
  const stackParts: string[] = [];
  if (stack.frontend) stackParts.push(`frontend: ${stack.frontend}`);
  if (stack.backend)  stackParts.push(`backend: ${stack.backend}`);
  const stackLine = stackParts.length > 0
    ? `\n**Stack de este proyecto:** ${stackParts.join(" | ")}\n`
    : "";
  const testLine = stack.testing
    ? `- Actualizá o agregá tests si corresponde (${stack.testing}).`
    : `- Actualizá o agregá tests si el proyecto tiene infraestructura de testing.`;

  return `## Instrucciones técnicas — Fullstack
${stackLine}
Analizá el flujo completo: UI → API → backend → persistencia → respuesta → UI.

### Frontend
- Revisá componentes, páginas, formularios y estado de UI involucrados.
- Respetá las convenciones y librerías ya presentes en el proyecto.
- Usá las mismas librerías de formularios y validación que ya usa el proyecto.
- Agregá loading, error y feedback apropiado.

### Backend y API
- Revisá servicios, validaciones y acceso a datos.
- Mantené compatibilidad con contratos existentes.
- Cuidá transacciones y reglas de negocio.
${testLine}

### Consistencia
- Verificá que el estado de la UI refleje correctamente el estado del backend.
- Revisá que errores del servidor se muestren de forma controlada en UI.
- No dejes flujos incompletos: si cambiás el backend, ajustá el frontend, y viceversa.`;
}

// ── Prompt type instructions ──────────────────────────────────────────────────

const PROMPT_TYPE_INSTRUCTIONS: Record<BacklogPromptType, string> = {
  IMPLEMENTATION: `\
## Instrucciones de tarea — Implementación

- Analizá primero: entendé el problema completamente antes de escribir código.
- Implementá la solución completa dentro del alcance definido. No dejes partes a medias.
- No te desvíes del scope. Si encontrás problemas relacionados que no son parte de esta tarea, mencionálos en la entrega pero no los corrijas automáticamente.
- Verificá que tu implementación no rompe funcionalidad existente. Pensá en efectos secundarios.
- Dejá un resumen claro de los cambios al finalizar.`,

  AUDIT: `\
## Instrucciones de tarea — Auditoría / Verificación

- Tu objetivo es revisar, no necesariamente corregir. Identificá si el problema existe y cuál es su alcance.
- Localizá exactamente dónde ocurre el problema: archivo(s), función(es), línea(s) si es posible.
- No corrijas nada salvo que la corrección sea explícitamente parte del alcance definido en este prompt.
- Revisá si el mismo problema puede existir en otros módulos o flujos similares.
- Devolvé hallazgos claros, concretos y accionables: qué encontraste, dónde, cuál es la causa probable.
- Incluí una propuesta técnica de resolución aunque no la implementes.`,

  INVESTIGATION: `\
## Instrucciones de tarea — Investigación técnica

- Tu objetivo es entender la causa raíz del problema o comportamiento.
- Seguí el flujo completo: desde el síntoma observable hasta el origen técnico real.
- Localizá los archivos, funciones y datos involucrados.
- Explicá claramente por qué ocurre el problema o comportamiento, no solo que ocurre.
- Incluí contexto técnico: tipos de datos, estado, flujo de ejecución, side effects.
- Terminá con una propuesta de solución técnica fundamentada. No la implementes salvo que se solicite.`,

  STRATEGY: `\
## Instrucciones de tarea — Estrategia / Definición

- Tu objetivo es evaluar opciones y recomendar una estrategia, no implementar código.
- Analizá las alternativas posibles considerando la arquitectura actual del proyecto.
- Para cada alternativa, describí trade-offs: complejidad, riesgo, mantenibilidad, tiempo.
- Recomendá una opción con fundamento técnico claro.
- No implementes código salvo que el prompt lo solicite explícitamente.
- Si hay decisiones técnicas abiertas o bloqueos, identificálos.`,
};

// ── Acceptance criteria by item type ─────────────────────────────────────────

function buildAcceptanceCriteria(
  item: BacklogItem,
  promptType: BacklogPromptType,
  targetRepo: BacklogPromptTargetRepo
): string {
  const base: string[] = [];

  if (promptType === "IMPLEMENTATION") {
    if (item.type === "BUG") {
      base.push(
        "El bug deja de reproducirse en el flujo reportado.",
        "No se rompieron flujos existentes relacionados.",
        "Si hay edge cases similares, fueron revisados.",
        "El cambio es consistente con la arquitectura del proyecto."
      );
    } else if (item.type === "FEATURE") {
      base.push(
        "La feature funciona correctamente en el flujo principal.",
        "Se manejan estados de error y loading apropiadamente.",
        "El diseño es consistente con el resto de la UI (si aplica).",
        "No hay regresos en funcionalidad existente.",
        "Se documentaron decisiones de diseño no obvias."
      );
    } else if (item.type === "TECH_DEBT") {
      base.push(
        "El refactor no cambia el comportamiento observable.",
        "El código resultante es más legible o mantenible.",
        "No hay regresos en funcionalidad existente.",
        "Los tests (si existen) siguen pasando."
      );
    } else if (item.type === "IMPLEMENTATION_NOT_VERIFIED") {
      base.push(
        "Se verificó que la implementación previa funciona correctamente.",
        "Los edge cases fueron revisados y contemplados.",
        "Se identificaron y corregido problemas si los había.",
        "El flujo fue probado end-to-end."
      );
    } else {
      base.push(
        "El objetivo planteado fue alcanzado.",
        "No hay regresos en funcionalidad existente.",
        "El cambio es consistente con la arquitectura del proyecto."
      );
    }
  } else if (promptType === "AUDIT") {
    base.push(
      "Se confirmó si el problema existe y en qué alcance.",
      "Los archivos y flujos afectados están identificados.",
      "Se entregó una propuesta técnica de resolución.",
      "Se mencionaron riesgos o módulos que podrían verse afectados."
    );
  } else if (promptType === "INVESTIGATION") {
    base.push(
      "La causa raíz está identificada y explicada con evidencia técnica.",
      "El flujo completo está mapeado.",
      "La propuesta de solución es técnicamente viable y considera la arquitectura actual.",
      "Se mencionaron riesgos o efectos secundarios potenciales."
    );
  } else if (promptType === "STRATEGY") {
    base.push(
      "Se evaluaron al menos 2 alternativas técnicas.",
      "Los trade-offs de cada alternativa están descriptos claramente.",
      "Se hizo una recomendación fundamentada.",
      "Se identificaron bloqueos o decisiones que requieren validación humana."
    );
  }

  if (targetRepo === "FRONTEND" || targetRepo === "FULLSTACK") {
    if (promptType === "IMPLEMENTATION") {
      base.push("La UI funciona correctamente en los navegadores/entornos objetivo.");
    }
  }

  return base.map((c) => `- ${c}`).join("\n");
}

// ── Contextual objective ──────────────────────────────────────────────────────

function buildObjective(
  item: BacklogItem,
  promptType: BacklogPromptType,
  targetRepo: BacklogPromptTargetRepo
): string {
  const repo = REPO_LABEL[targetRepo].toLowerCase();

  if (promptType === "IMPLEMENTATION") {
    if (item.type === "BUG") {
      return `Reproducir, localizar y corregir el bug en ${repo}. El objetivo es que el comportamiento incorrecto deje de ocurrir sin romper flujos existentes.`;
    }
    if (item.type === "TECH_DEBT") {
      return `Refactorizar o resolver la deuda técnica identificada en ${repo}. El objetivo es mejorar la calidad del código sin cambiar el comportamiento observable.`;
    }
    if (item.type === "FEATURE") {
      return `Implementar la feature en ${repo} dentro del alcance definido. El objetivo es que funcione correctamente, sea consistente con el sistema existente y no genere regresos.`;
    }
    if (item.type === "IMPLEMENTATION_NOT_VERIFIED") {
      return `Verificar y completar una implementación previa realizada por un agente en ${repo}. El objetivo es confirmar que funciona correctamente, detectar problemas y corregirlos si los hay.`;
    }
    if (item.type === "VALIDATION_PENDING") {
      return `Verificar y, si corresponde, implementar la corrección en ${repo}. El objetivo es confirmar el estado actual y resolver el pendiente de validación.`;
    }
    return `Resolver el pendiente en ${repo}. El objetivo es alcanzar el resultado descrito de forma correcta y consistente con la arquitectura existente.`;
  }

  if (promptType === "AUDIT") {
    return `Auditar y verificar el estado actual en ${repo}. El objetivo es confirmar si el problema existe, identificar su alcance y devolver hallazgos accionables.`;
  }

  if (promptType === "INVESTIGATION") {
    return `Investigar la causa raíz del problema en ${repo}. El objetivo es entender qué ocurre, por qué ocurre y proponer una solución técnica fundamentada.`;
  }

  if (promptType === "STRATEGY") {
    return `Definir una estrategia para abordar este pendiente en ${repo}. El objetivo es evaluar opciones, analizar trade-offs y recomendar el mejor camino técnico.`;
  }

  return `Resolver el pendiente identificado en ${repo}.`;
}

// ── Main generator ────────────────────────────────────────────────────────────

export interface GeneratedPrompt {
  title: string;
  content: string;
}

export function generatePrompt(
  item: BacklogItem,
  targetRepo: BacklogPromptTargetRepo,
  promptType: BacklogPromptType,
  stack: StackConfig = {}
): GeneratedPrompt {
  const repoLabel = REPO_LABEL[targetRepo];
  const typeLabel = PROMPT_TYPE_LABEL[promptType];
  const itemTypeLabel = TYPE_LABEL[item.type] ?? item.type;

  const title = `${repoLabel} · ${typeLabel} — ${item.title}`;

  const techInstructions = buildTechInstructions(targetRepo, stack);

  const contextLines: string[] = [
    `- **Tipo de pendiente:** ${itemTypeLabel}`,
    `- **Módulo:** ${item.module ?? "—"}`,
    `- **Área:** ${item.area ?? "—"}`,
    `- **Proyecto:** ${item.project ?? "—"}`,
    `- **ID interno:** \`${item.id}\``,
  ];

  const parts: string[] = [
    `# ${title}`,
    "",
    `## Objetivo`,
    "",
    buildObjective(item, promptType, targetRepo),
    "",
    "---",
    "",
    `## Contexto del pendiente`,
    "",
    contextLines.join("\n"),
    "",
    `### Descripción`,
    "",
    item.description || "(Sin descripción registrada)",
    "",
    ...(item.originContext ? [
      `### Contexto de origen`,
      "",
      item.originContext,
      "",
    ] : []),
    ...(item.whyItMatters ? [
      `### Por qué importa`,
      "",
      item.whyItMatters,
      "",
    ] : []),
    ...(item.suggestedNextStep ? [
      `### Siguiente paso sugerido`,
      "",
      item.suggestedNextStep,
      "",
    ] : []),
    ...(item.rawExcerpt ? [
      `### Fragmento original`,
      "",
      `> ${item.rawExcerpt.replace(/\n/g, "\n> ")}`,
      "",
    ] : []),
    "---",
    "",
    MANDATORY_PRE_WORK,
    "",
    "---",
    "",
    techInstructions,
    "",
    "---",
    "",
    PROMPT_TYPE_INSTRUCTIONS[promptType],
    "",
    "---",
    "",
    `## Criterios de aceptación`,
    "",
    buildAcceptanceCriteria(item, promptType, targetRepo),
    "",
    "---",
    "",
    `## Entrega esperada`,
    "",
    `Al finalizar, devolveme:`,
    "",
    `1. **Qué encontraste** — resumen técnico del problema o situación.`,
    `2. **Qué cambiaste** — lista de cambios realizados (o "ninguno" si es solo auditoría/estrategia).`,
    `3. **Archivos principales modificados** — rutas relativas.`,
    `4. **Riesgos o puntos a probar manualmente** — qué debería verificar yo como usuario.`,
    `5. **Tests** — si agregaste tests, cuáles. Si no pudiste, por qué y qué habría que testear.`,
    `6. **Pendientes explícitos** — si no pudiste cerrar algo, dejalo documentado claramente.`,
  ];

  return {
    title,
    content: parts.join("\n"),
  };
}
