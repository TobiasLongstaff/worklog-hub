import type { BacklogItemRepository } from "../repository/backlog-item-repository.ts";
import type { BacklogEvidenceRepository } from "../repository/backlog-evidence-repository.ts";
import type { BacklogPromptRepository } from "../repository/backlog-prompt-repository.ts";
import type { AgentTaskRepository } from "../repository/agent-task-repository.ts";
import type {
  AddEvidenceInput,
  AgentTask,
  AgentTaskAgent,
  BacklogEvidence,
  BacklogItem,
  BacklogItemStatus,
  BacklogPrompt,
  BacklogPromptTargetRepo,
  BacklogPromptType,
  BacklogStats,
  CreateBacklogItemInput,
  GeneratePromptInput,
  ListBacklogItemsFilter,
  UpdateBacklogItemInput,
} from "../domain/types.ts";
import { generatePrompt } from "./prompt-generator.ts";
import type { AgentExecutor, ProjectPaths } from "./agent-executor.ts";
import type { StackConfig } from "../../config/load-config.ts";

const VALID_TRANSITIONS: Record<BacklogItemStatus, BacklogItemStatus[]> = {
  DETECTED:               ["ACCEPTED", "DISCARDED"],
  ACCEPTED:               ["ASSIGNED_TO_AGENT", "NEEDS_MANUAL_TEST", "DISCARDED"],
  ASSIGNED_TO_AGENT:      ["IMPLEMENTED_CLAIMED", "ACCEPTED", "DISCARDED"],
  IMPLEMENTED_CLAIMED:    ["IMPLEMENTED_SUSPECTED", "NEEDS_MANUAL_TEST", "VERIFIED_DONE", "REOPENED"],
  IMPLEMENTED_SUSPECTED:  ["NEEDS_MANUAL_TEST", "VERIFIED_DONE", "REOPENED"],
  NEEDS_MANUAL_TEST:      ["VERIFIED_DONE", "REOPENED"],
  VERIFIED_DONE:          ["REOPENED"],
  DISCARDED:              ["REOPENED"],
  REOPENED:               ["ACCEPTED", "DISCARDED", "NEEDS_MANUAL_TEST", "ASSIGNED_TO_AGENT"],
};

export class BacklogService {
  constructor(
    private readonly itemRepo: BacklogItemRepository,
    private readonly evidenceRepo: BacklogEvidenceRepository,
    private readonly promptRepo: BacklogPromptRepository,
    private readonly taskRepo: AgentTaskRepository,
    private readonly executor: AgentExecutor,
    private readonly projectPaths: ProjectPaths,
    private readonly stack: StackConfig = {}
  ) {}

  // ── Items ─────────────────────────────────────────────────────────────────

  getItem(id: string): BacklogItem | null {
    return this.itemRepo.findById(id);
  }

  listItems(filter: ListBacklogItemsFilter = {}): BacklogItem[] {
    return this.itemRepo.findAll(filter);
  }

  getStats(): BacklogStats {
    return this.itemRepo.getStats();
  }

  createItem(input: CreateBacklogItemInput): BacklogItem {
    const now = new Date().toISOString();
    return this.itemRepo.create({
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
  }

  updateItem(id: string, input: UpdateBacklogItemInput): BacklogItem {
    const existing = this.itemRepo.findById(id);
    if (!existing) throw new Error(`Item ${id} no encontrado`);

    const updated = this.itemRepo.update(id, {
      ...input,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) throw new Error(`No se pudo actualizar el item ${id}`);
    return updated;
  }

  transitionStatus(id: string, newStatus: BacklogItemStatus): BacklogItem {
    const existing = this.itemRepo.findById(id);
    if (!existing) throw new Error(`Item ${id} no encontrado`);

    const allowed = VALID_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Transición inválida: ${existing.status} → ${newStatus}. Permitidas: ${allowed.join(", ")}`
      );
    }

    const now = new Date().toISOString();
    const ts: Parameters<typeof this.itemRepo.updateStatus>[2] = { updatedAt: now };

    if (newStatus === "ACCEPTED") ts.acceptedAt = now;
    if (newStatus === "VERIFIED_DONE") ts.verifiedAt = now;
    if (newStatus === "DISCARDED") ts.discardedAt = now;
    if (newStatus === "REOPENED") ts.reopenedAt = now;

    const updated = this.itemRepo.updateStatus(id, newStatus, ts);
    if (!updated) throw new Error(`No se pudo actualizar el estado del item ${id}`);
    return updated;
  }

  // ── Evidence ──────────────────────────────────────────────────────────────

  getEvidences(backlogItemId: string): BacklogEvidence[] {
    if (!this.itemRepo.findById(backlogItemId)) {
      throw new Error(`Item ${backlogItemId} no encontrado`);
    }
    return this.evidenceRepo.findByItemId(backlogItemId);
  }

  addEvidence(backlogItemId: string, input: AddEvidenceInput): BacklogEvidence {
    if (!this.itemRepo.findById(backlogItemId)) {
      throw new Error(`Item ${backlogItemId} no encontrado`);
    }
    return this.evidenceRepo.create({
      id: crypto.randomUUID(),
      backlogItemId,
      ...input,
      createdAt: new Date().toISOString(),
    });
  }

  // ── Prompts ───────────────────────────────────────────────────────────────

  getPrompts(backlogItemId: string): BacklogPrompt[] {
    if (!this.itemRepo.findById(backlogItemId)) {
      throw new Error(`Item ${backlogItemId} no encontrado`);
    }
    return this.promptRepo.findByItemId(backlogItemId);
  }

  getActivePrompt(backlogItemId: string): BacklogPrompt | null {
    if (!this.itemRepo.findById(backlogItemId)) {
      throw new Error(`Item ${backlogItemId} no encontrado`);
    }
    return this.promptRepo.findActiveByItemId(backlogItemId);
  }

  generateAndSavePrompt(
    backlogItemId: string,
    input: GeneratePromptInput
  ): BacklogPrompt {
    const item = this.itemRepo.findById(backlogItemId);
    if (!item) throw new Error(`Item ${backlogItemId} no encontrado`);

    const { title, content } = generatePrompt(item, input.targetRepo, input.promptType, this.stack);
    const now = new Date().toISOString();

    return this.promptRepo.create({
      id: crypto.randomUUID(),
      backlogItemId,
      targetRepo: input.targetRepo,
      promptType: input.promptType,
      title,
      content,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ── Agent Tasks ───────────────────────────────────────────────────────────

  getAgentTasks(backlogItemId: string): AgentTask[] {
    if (!this.itemRepo.findById(backlogItemId)) {
      throw new Error(`Item ${backlogItemId} no encontrado`);
    }
    return this.taskRepo.findByItemId(backlogItemId);
  }

  async dispatchAgentTask(
    backlogItemId: string,
    backlogPromptId: string,
    agent: AgentTaskAgent
  ): Promise<AgentTask> {
    const item = this.itemRepo.findById(backlogItemId);
    if (!item) throw new Error(`Item ${backlogItemId} no encontrado`);

    const prompt = this.promptRepo.findById(backlogPromptId);
    if (!prompt) throw new Error(`Prompt ${backlogPromptId} no encontrado`);
    if (prompt.backlogItemId !== backlogItemId) {
      throw new Error("El prompt no pertenece a este item");
    }

    const now = new Date().toISOString();
    const taskId = crypto.randomUUID();

    // Write prompt file
    const promptFilePath = this.executor.writePromptFile(taskId, prompt.content);

    // Resolve project path
    const projectPath = this.executor.resolveProjectPath(prompt.targetRepo, this.projectPaths);

    // Build CLI command
    const agentCommand = this.executor.buildCommand(agent, promptFilePath, projectPath);

    // Create task in DB
    const task = this.taskRepo.create({
      id: taskId,
      backlogItemId,
      backlogPromptId,
      agent,
      targetRepo: prompt.targetRepo,
      promptSnapshot: prompt.content,
      promptFilePath,
      agentCommand,
      status: "READY_TO_SEND",
      createdAt: now,
      updatedAt: now,
    });

    // Transition item to ASSIGNED_TO_AGENT if possible
    const assignableFrom: BacklogItemStatus[] = [
      "DETECTED", "ACCEPTED", "REOPENED",
    ];
    if (assignableFrom.includes(item.status)) {
      try {
        this.transitionStatus(backlogItemId, "ASSIGNED_TO_AGENT");
      } catch {
        // If transition not valid from current state, leave status as-is
      }
    }

    // Attempt actual dispatch (currently returns READY_TO_SEND)
    await this.executor.dispatch(task);

    return task;
  }

  markTaskSent(taskId: string): AgentTask {
    const task = this.taskRepo.findById(taskId);
    if (!task) throw new Error(`Tarea ${taskId} no encontrada`);

    const now = new Date().toISOString();
    const updated = this.taskRepo.updateStatus(taskId, "SENT", {
      updatedAt: now,
      sentAt: now,
    });
    if (!updated) throw new Error(`No se pudo actualizar la tarea ${taskId}`);
    return updated;
  }

  updateTaskStatus(
    taskId: string,
    status: "SENT" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED",
    outputSummary?: string
  ): AgentTask {
    const task = this.taskRepo.findById(taskId);
    if (!task) throw new Error(`Tarea ${taskId} no encontrada`);

    const now = new Date().toISOString();
    const ts: Parameters<typeof this.taskRepo.updateStatus>[2] = { updatedAt: now };

    if (status === "SENT") ts.sentAt = now;
    if (status === "RUNNING") ts.startedAt = now;
    if (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") {
      ts.finishedAt = now;
    }
    if (outputSummary !== undefined) ts.outputSummary = outputSummary;

    const updated = this.taskRepo.updateStatus(taskId, status, ts);
    if (!updated) throw new Error(`No se pudo actualizar la tarea ${taskId}`);
    return updated;
  }
}
