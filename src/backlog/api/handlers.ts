import type { BacklogService } from "../service/backlog-service.ts";
import type {
  AgentTaskAgent,
  BacklogItemArea,
  BacklogItemSource,
  BacklogItemStatus,
  BacklogItemType,
  BacklogEvidenceType,
  BacklogPromptTargetRepo,
  BacklogPromptType,
} from "../domain/types.ts";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400): Response {
  return json({ error: message }, status);
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function createApiHandler(service: BacklogService) {
  return async function handleApiRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const { pathname, searchParams } = url;
    const method = req.method.toUpperCase();

    // Strip /api prefix
    const path = pathname.replace(/^\/api/, "");

    // ── Backlog stats ──────────────────────────────────────────────────────
    if (method === "GET" && path === "/backlog/stats") {
      return json(service.getStats());
    }

    // ── List items ─────────────────────────────────────────────────────────
    if (method === "GET" && path === "/backlog") {
      const items = service.listItems({
        status: searchParams.get("status") as BacklogItemStatus | undefined ?? undefined,
        type: searchParams.get("type") as BacklogItemType | undefined ?? undefined,
        source: searchParams.get("source") as BacklogItemSource | undefined ?? undefined,
        project: searchParams.get("project") ?? undefined,
        module: searchParams.get("module") ?? undefined,
        area: searchParams.get("area") as BacklogItemArea | undefined ?? undefined,
        search: searchParams.get("search") ?? undefined,
        limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined,
        offset: searchParams.has("offset") ? Number(searchParams.get("offset")) : undefined,
      });
      return json(items);
    }

    // ── Create item ────────────────────────────────────────────────────────
    if (method === "POST" && path === "/backlog") {
      const body = await parseBody(req);
      const title = body["title"] as string | undefined;
      const type = body["type"] as BacklogItemType | undefined;
      const source = (body["source"] as BacklogItemSource | undefined) ?? "MANUAL";
      const description = (body["description"] as string | undefined) ?? "";
      const originContext = (body["originContext"] as string | undefined) ?? "";

      if (!title || !type) return jsonError("Campos requeridos: title, type");

      try {
        const item = service.createItem({
          title, type, source, description, originContext,
          project: body["project"] as string | undefined,
          module: body["module"] as string | undefined,
          area: body["area"] as BacklogItemArea | undefined,
          whyItMatters: body["whyItMatters"] as string | undefined,
          suggestedNextStep: body["suggestedNextStep"] as string | undefined,
          rawExcerpt: body["rawExcerpt"] as string | undefined,
        });
        return json(item, 201);
      } catch (err) {
        return jsonError(String(err), 500);
      }
    }

    // ── Route patterns ─────────────────────────────────────────────────────
    const itemMatch        = path.match(/^\/backlog\/([^/]+)$/);
    const statusMatch      = path.match(/^\/backlog\/([^/]+)\/status$/);
    const evidenceMatch    = path.match(/^\/backlog\/([^/]+)\/evidence$/);
    const promptsMatch     = path.match(/^\/backlog\/([^/]+)\/prompts$/);
    const agentTasksMatch  = path.match(/^\/backlog\/([^/]+)\/agent-tasks$/);
    const taskStatusMatch  = path.match(/^\/backlog\/([^/]+)\/agent-tasks\/([^/]+)\/status$/);

    // ── GET /backlog/:id ───────────────────────────────────────────────────
    if (method === "GET" && itemMatch) {
      const id = itemMatch[1]!;
      const item = service.getItem(id);
      if (!item) return jsonError("No encontrado", 404);
      return json(item);
    }

    // ── PATCH /backlog/:id ─────────────────────────────────────────────────
    if (method === "PATCH" && itemMatch) {
      const id = itemMatch[1]!;
      const body = await parseBody(req);
      try {
        const updated = service.updateItem(id, {
          title: body["title"] as string | undefined,
          type: body["type"] as BacklogItemType | undefined,
          module: body["module"] as string | undefined,
          area: body["area"] as BacklogItemArea | undefined,
          description: body["description"] as string | undefined,
          originContext: body["originContext"] as string | undefined,
          whyItMatters: body["whyItMatters"] as string | undefined,
          suggestedNextStep: body["suggestedNextStep"] as string | undefined,
        });
        return json(updated);
      } catch (err) {
        return jsonError(String(err), 400);
      }
    }

    // ── POST /backlog/:id/status ───────────────────────────────────────────
    if (method === "POST" && statusMatch) {
      const id = statusMatch[1]!;
      const body = await parseBody(req);
      const newStatus = body["status"] as BacklogItemStatus | undefined;
      if (!newStatus) return jsonError("Campo requerido: status");
      try {
        const updated = service.transitionStatus(id, newStatus);
        return json(updated);
      } catch (err) {
        return jsonError(String(err), 400);
      }
    }

    // ── GET /backlog/:id/evidence ──────────────────────────────────────────
    if (method === "GET" && evidenceMatch) {
      const id = evidenceMatch[1]!;
      try {
        return json(service.getEvidences(id));
      } catch (err) {
        return jsonError(String(err), 404);
      }
    }

    // ── POST /backlog/:id/evidence ─────────────────────────────────────────
    if (method === "POST" && evidenceMatch) {
      const id = evidenceMatch[1]!;
      const body = await parseBody(req);
      const type = body["type"] as BacklogEvidenceType | undefined;
      const summary = body["summary"] as string | undefined;
      if (!type || !summary) return jsonError("Campos requeridos: type, summary");
      try {
        const evidence = service.addEvidence(id, {
          type, summary,
          rawReference: body["rawReference"] as string | undefined,
          metadataJson: body["metadataJson"] as string | undefined,
        });
        return json(evidence, 201);
      } catch (err) {
        return jsonError(String(err), 400);
      }
    }

    // ── GET /backlog/:id/prompts ───────────────────────────────────────────
    if (method === "GET" && promptsMatch) {
      const id = promptsMatch[1]!;
      try {
        return json(service.getPrompts(id));
      } catch (err) {
        return jsonError(String(err), 404);
      }
    }

    // ── POST /backlog/:id/prompts (generate) ───────────────────────────────
    if (method === "POST" && promptsMatch) {
      const id = promptsMatch[1]!;
      const body = await parseBody(req);
      const targetRepo = body["targetRepo"] as BacklogPromptTargetRepo | undefined;
      const promptType = body["promptType"] as BacklogPromptType | undefined;
      if (!targetRepo || !promptType) {
        return jsonError("Campos requeridos: targetRepo, promptType");
      }
      try {
        const prompt = service.generateAndSavePrompt(id, { targetRepo, promptType });
        return json(prompt, 201);
      } catch (err) {
        return jsonError(String(err), 400);
      }
    }

    // ── GET /backlog/:id/agent-tasks ───────────────────────────────────────
    if (method === "GET" && agentTasksMatch) {
      const id = agentTasksMatch[1]!;
      try {
        return json(service.getAgentTasks(id));
      } catch (err) {
        return jsonError(String(err), 404);
      }
    }

    // ── POST /backlog/:id/agent-tasks (dispatch) ───────────────────────────
    if (method === "POST" && agentTasksMatch) {
      const id = agentTasksMatch[1]!;
      const body = await parseBody(req);
      const backlogPromptId = body["backlogPromptId"] as string | undefined;
      const agent = body["agent"] as AgentTaskAgent | undefined;
      if (!backlogPromptId || !agent) {
        return jsonError("Campos requeridos: backlogPromptId, agent");
      }
      try {
        const task = await service.dispatchAgentTask(id, backlogPromptId, agent);
        return json(task, 201);
      } catch (err) {
        return jsonError(String(err), 400);
      }
    }

    // ── POST /backlog/:id/agent-tasks/:taskId/status ───────────────────────
    if (method === "POST" && taskStatusMatch) {
      const taskId = taskStatusMatch[2]!;
      const body = await parseBody(req);
      const status = body["status"] as "SENT" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | undefined;
      const outputSummary = body["outputSummary"] as string | undefined;
      if (!status) return jsonError("Campo requerido: status");
      try {
        const updated = service.updateTaskStatus(taskId, status, outputSummary);
        return json(updated);
      } catch (err) {
        return jsonError(String(err), 400);
      }
    }

    return jsonError("Ruta no encontrada", 404);
  };
}
