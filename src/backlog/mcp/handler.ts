import type { BacklogService } from "../service/backlog-service.ts";
import type {
  BacklogItemArea,
  BacklogItemStatus,
  BacklogItemType,
} from "../domain/types.ts";

// MCP tools definitions
const TOOLS = [
  {
    name: "create_backlog_item",
    description:
      "Crea en Worklog Hub un nuevo pendiente detectado durante una conversación, " +
      "SOLO cuando el usuario confirmó explícitamente que quiere registrarlo. " +
      "Usar para: bugs, deuda técnica, features postergadas, validaciones pendientes, " +
      "decisiones abiertas o ideas mencionadas. " +
      "NO usar sin confirmación previa del usuario.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título corto y descriptivo del pendiente (máx 120 caracteres)",
        },
        type: {
          type: "string",
          enum: [
            "BUG",
            "TECH_DEBT",
            "FEATURE",
            "VALIDATION_PENDING",
            "OPEN_DECISION",
            "IMPLEMENTATION_NOT_VERIFIED",
            "IDEA",
          ],
          description: "Categoría del pendiente",
        },
        description: {
          type: "string",
          description: "Descripción detallada del problema o pendiente",
        },
        originContext: {
          type: "string",
          description:
            "Contexto de la conversación donde surgió este pendiente. " +
            "Incluir la pregunta o comentario del usuario que lo originó.",
        },
        project: {
          type: "string",
          description: "Nombre del proyecto relacionado (ej: facturacion-system)",
        },
        module: {
          type: "string",
          description: "Módulo o área del sistema (ej: Cheques, Notas de crédito)",
        },
        area: {
          type: "string",
          enum: ["FRONTEND", "BACKEND", "FULLSTACK", "PRODUCT", "UX", "UNKNOWN"],
          description: "Área técnica del pendiente",
        },
        whyItMatters: {
          type: "string",
          description: "Por qué es importante resolver esto",
        },
        suggestedNextStep: {
          type: "string",
          description: "Siguiente paso concreto recomendado para resolver el pendiente",
        },
        rawExcerpt: {
          type: "string",
          description:
            "Fragmento textual corto de la conversación que originó el pendiente (máx 500 caracteres)",
        },
      },
      required: ["title", "type", "description", "originContext"],
    },
  },
  {
    name: "list_backlog_items",
    description:
      "Lista los pendientes registrados en Worklog Hub. " +
      "Usar para responder preguntas como: ¿qué pendientes tengo abiertos?, " +
      "¿qué quedó sin probar?, ¿qué detecté esta semana relacionado con Cheques?",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [
            "DETECTED",
            "ACCEPTED",
            "ASSIGNED_TO_AGENT",
            "IMPLEMENTED_CLAIMED",
            "IMPLEMENTED_SUSPECTED",
            "NEEDS_MANUAL_TEST",
            "VERIFIED_DONE",
            "DISCARDED",
            "REOPENED",
          ],
          description: "Filtrar por estado",
        },
        type: {
          type: "string",
          enum: [
            "BUG",
            "TECH_DEBT",
            "FEATURE",
            "VALIDATION_PENDING",
            "OPEN_DECISION",
            "IMPLEMENTATION_NOT_VERIFIED",
            "IDEA",
          ],
          description: "Filtrar por tipo",
        },
        project: {
          type: "string",
          description: "Filtrar por nombre de proyecto",
        },
        module: {
          type: "string",
          description: "Filtrar por módulo o área del sistema",
        },
        search: {
          type: "string",
          description: "Buscar en título, descripción y contexto",
        },
        limit: {
          type: "number",
          description: "Cantidad máxima de resultados (por defecto: 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_backlog_item",
    description:
      "Obtiene el detalle completo de un pendiente específico por su ID. " +
      "Usar cuando el usuario quiere ver los detalles de un pendiente en particular.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID único del pendiente",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "update_backlog_item_status",
    description:
      "Cambia el estado de un pendiente en Worklog Hub. " +
      "SOLO usar con confirmación explícita del usuario. " +
      "Útil para: marcar como descartado, aceptar un pendiente detectado, " +
      "o confirmar que algo ya fue validado manualmente.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID único del pendiente a actualizar",
        },
        status: {
          type: "string",
          enum: [
            "ACCEPTED",
            "ASSIGNED_TO_AGENT",
            "IMPLEMENTED_CLAIMED",
            "IMPLEMENTED_SUSPECTED",
            "NEEDS_MANUAL_TEST",
            "VERIFIED_DONE",
            "DISCARDED",
            "REOPENED",
          ],
          description: "Nuevo estado del pendiente",
        },
      },
      required: ["id", "status"],
    },
  },
];

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

function rpcOk(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function rpcErr(
  id: string | number | null,
  code: number,
  message: string
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleMethod(
  method: string,
  params: unknown,
  service: BacklogService
): Promise<unknown> {
  const p = params as Record<string, unknown>;

  if (method === "initialize") {
    return {
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: "worklog-hub-backlog", version: "1.0.0" },
    };
  }

  if (method === "notifications/initialized") {
    return null;
  }

  if (method === "tools/list") {
    return { tools: TOOLS };
  }

  if (method === "tools/call") {
    const toolName = p["name"] as string;
    const args = (p["arguments"] ?? {}) as Record<string, unknown>;
    const text = await callTool(toolName, args, service);
    return { content: [{ type: "text", text }] };
  }

  throw Object.assign(new Error(`Método desconocido: ${method}`), { code: -32601 });
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  service: BacklogService
): Promise<string> {
  if (name === "create_backlog_item") {
    const item = service.createItem({
      title: String(args["title"] ?? ""),
      type: args["type"] as BacklogItemType,
      source: "CHATGPT",
      description: String(args["description"] ?? ""),
      originContext: String(args["originContext"] ?? ""),
      project: args["project"] as string | undefined,
      module: args["module"] as string | undefined,
      area: args["area"] as BacklogItemArea | undefined,
      whyItMatters: args["whyItMatters"] as string | undefined,
      suggestedNextStep: args["suggestedNextStep"] as string | undefined,
      rawExcerpt: args["rawExcerpt"] as string | undefined,
    });
    return JSON.stringify({
      ok: true,
      id: item.id,
      title: item.title,
      status: item.status,
      source: item.source,
      createdAt: item.createdAt,
    });
  }

  if (name === "list_backlog_items") {
    const items = service.listItems({
      status: args["status"] as BacklogItemStatus | undefined,
      type: args["type"] as BacklogItemType | undefined,
      project: args["project"] as string | undefined,
      module: args["module"] as string | undefined,
      search: args["search"] as string | undefined,
      limit: args["limit"] !== undefined ? Number(args["limit"]) : 20,
    });
    if (items.length === 0) {
      return "No se encontraron pendientes con los filtros aplicados.";
    }
    const lines = items.map(
      (it) =>
        `[${it.id.slice(0, 8)}] ${it.title}\n` +
        `  Estado: ${it.status} | Tipo: ${it.type} | Módulo: ${it.module ?? "-"}\n` +
        `  ${it.description.slice(0, 120)}${it.description.length > 120 ? "…" : ""}`
    );
    return `${items.length} pendiente(s) encontrado(s):\n\n${lines.join("\n\n")}`;
  }

  if (name === "get_backlog_item") {
    const id = String(args["id"] ?? "");
    const item = service.getItem(id);
    if (!item) return `No se encontró el pendiente con ID: ${id}`;
    return JSON.stringify(item, null, 2);
  }

  if (name === "update_backlog_item_status") {
    const id = String(args["id"] ?? "");
    const status = args["status"] as BacklogItemStatus;
    try {
      const updated = service.transitionStatus(id, status);
      return `Estado actualizado: ${updated.title} → ${updated.status}`;
    } catch (err) {
      return `Error: ${String(err)}`;
    }
  }

  throw Object.assign(new Error(`Herramienta desconocida: ${name}`), { code: -32601 });
}

export function createMcpHandler(service: BacklogService) {
  return async function handleMcpRequest(req: Request): Promise<Response> {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let body: JsonRpcRequest;
    try {
      body = (await req.json()) as JsonRpcRequest;
    } catch {
      return new Response(
        JSON.stringify(rpcErr(null, -32700, "Parse error")),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const id = body.id ?? null;

    // Notifications (no id) have no response
    if (body.method === "notifications/initialized") {
      return new Response(null, { status: 204 });
    }

    try {
      const result = await handleMethod(body.method, body.params, service);
      return new Response(JSON.stringify(rpcOk(id, result)), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: unknown) {
      const code = (err as { code?: number }).code ?? -32603;
      return new Response(
        JSON.stringify(rpcErr(id, code, String(err))),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  };
}
