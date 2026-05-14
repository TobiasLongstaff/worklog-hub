/**
 * Seed de desarrollo — inserta ítems de ejemplo para ver la UI.
 * Correr SOLO en entorno de desarrollo:
 *   bun run backlog:seed
 */

import { join } from "path";
import { getDb } from "../src/backlog/db/connection.ts";
import { BacklogItemRepository } from "../src/backlog/repository/backlog-item-repository.ts";
import { BacklogEvidenceRepository } from "../src/backlog/repository/backlog-evidence-repository.ts";
import { BacklogPromptRepository } from "../src/backlog/repository/backlog-prompt-repository.ts";
import { AgentTaskRepository } from "../src/backlog/repository/agent-task-repository.ts";
import { BacklogService } from "../src/backlog/service/backlog-service.ts";
import { AgentExecutor } from "../src/backlog/service/agent-executor.ts";

const HUB_ROOT = join(import.meta.dir, "..");
const db = getDb(HUB_ROOT);
const service = new BacklogService(
  new BacklogItemRepository(db),
  new BacklogEvidenceRepository(db),
  new BacklogPromptRepository(db),
  new AgentTaskRepository(db),
  new AgentExecutor(HUB_ROOT),
  { frontend: null, backend: null }
);

const SEED_ITEMS = [
  {
    title: "Filtro Todo de cheques no muestra todos los registros",
    type: "BUG" as const,
    source: "CHATGPT" as const,
    project: "facturacion-system",
    module: "Cheques",
    area: "FRONTEND" as const,
    description:
      "Al seleccionar el filtro 'Todo' en la grilla de cheques, no aparecen todos los registros. " +
      "Parece que hay un límite hardcodeado o un filtro por defecto que no se limpia correctamente.",
    originContext:
      "ChatGPT - conversación sobre bugs reportados por el cliente en el módulo de cheques. " +
      "El cliente mencionó que falta un cheque específico cuando selecciona 'Todos'.",
    whyItMatters:
      "Impacta directamente en la confiabilidad del módulo de cheques. " +
      "El cliente puede tomar decisiones basadas en información incompleta.",
    suggestedNextStep:
      "Revisar el handler de filtro en ChequeGrid.tsx y verificar si hay paginación o condición WHERE que no se limpia al cambiar a 'Todo'.",
  },
  {
    title: "Revisar si el desfase de fechas de notas de crédito aparece en otras pantallas",
    type: "VALIDATION_PENDING" as const,
    source: "CHATGPT" as const,
    project: "facturacion-system",
    module: "Notas de crédito",
    area: "FULLSTACK" as const,
    description:
      "Se detectó un desfase de fechas en el módulo de notas de crédito: las fechas se muestran " +
      "con un día de diferencia en algunos casos. Se sospecha que es un problema de timezone que " +
      "podría afectar también a otros módulos que muestran fechas (facturas, remitos, pagos).",
    originContext:
      "ChatGPT - análisis de bugs reportados. Se confirmó el bug en notas de crédito pero " +
      "quedó pendiente verificar si el mismo problema está en otros módulos.",
    whyItMatters:
      "Un error de fechas puede causar inconsistencias en reportes contables y auditorías. " +
      "Si está en más módulos, el impacto es mayor.",
    suggestedNextStep:
      "Crear un test que verifique el formateo de fechas en todos los módulos con grillas de datos. " +
      "Revisar si se usa la misma función utilitaria o cada módulo tiene su propia lógica.",
  },
  {
    title: "Corregir checks del modal Aplicar deuda en cheques recibidos y verificar aplicaciones previas",
    type: "IMPLEMENTATION_NOT_VERIFIED" as const,
    source: "CLAUDE_CODE" as const,
    project: "facturacion-system",
    module: "Cheques",
    area: "FRONTEND" as const,
    description:
      "El modal 'Aplicar deuda' en cheques recibidos tiene validaciones incorrectas: " +
      "permite aplicar el mismo cheque dos veces si el usuario navega de cierta forma. " +
      "Claude Code afirmó haber corregido los checks de validación en el modal.",
    originContext:
      "Sesión de Claude Code del 2025-05-10. El agente modificó ModalAplicarDeuda.tsx y " +
      "AplicarDeudaService.ts según sus logs, pero los cambios no fueron testeados manualmente.",
    whyItMatters:
      "Una doble aplicación de cheque causa inconsistencias contables graves. " +
      "Esta implementación del agente requiere validación humana antes de ir a producción.",
    suggestedNextStep:
      "Abrir el modal en el entorno de desarrollo, intentar aplicar el mismo cheque dos veces " +
      "siguiendo el flujo reportado, y verificar que el sistema lo rechace correctamente.",
    rawExcerpt:
      "[Claude Code] Modifiqué ModalAplicarDeuda.tsx para agregar validación de duplicados. " +
      "También actualicé AplicarDeudaService.ts para verificar aplicaciones previas antes de procesar.",
  },
];

async function main() {
  console.log("\n[backlog:seed] Insertando datos de ejemplo…\n");

  const existing = service.listItems({ limit: 1 });
  if (existing.length > 0) {
    console.log("  La base ya tiene datos. El seed no sobreescribe ítems existentes.\n");
    console.log("  Para resetear: eliminá el archivo data/worklog-hub.sqlite y corré el seed de nuevo.\n");
    process.exit(0);
  }

  for (const seed of SEED_ITEMS) {
    const item = service.createItem(seed);
    console.log(`  ✓ [${item.type}] ${item.title}`);

    if (seed.type === "IMPLEMENTATION_NOT_VERIFIED") {
      await service.transitionStatus(item.id, "ACCEPTED");
      await service.addEvidence(item.id, {
        type: "AGENT_LOG",
        summary:
          "Claude Code modificó ModalAplicarDeuda.tsx y AplicarDeudaService.ts en sesión del 2025-05-10",
        rawReference: "~/.claude/projects/facturacion-front/*.jsonl",
        metadataJson: JSON.stringify({ sessionDate: "2025-05-10", agentType: "CLAUDE_CODE" }),
      });
    }

    if (seed.type === "VALIDATION_PENDING") {
      await service.transitionStatus(item.id, "ACCEPTED");
    }
  }

  console.log("\n  Seed completado. Abrí http://localhost:3131 para ver los datos.\n");
}

main().catch((err) => {
  console.error(`[error] ${err}`);
  process.exit(1);
});
