import type { DailySummaryService } from "../service/daily-summary-service.ts";
import type { DailySummaryGeneratorService } from "../service/daily-summary-generator-service.ts";
import type { DailySummarySource } from "../domain/types.ts";

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

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createDailySummaryHandler(
  service: DailySummaryService,
  generator: DailySummaryGeneratorService
) {
  return async function handleDailySummaryRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, "");
    const method = req.method.toUpperCase();

    // ── GET /daily-summary?date=YYYY-MM-DD&project=xxx ────────────────────
    if (method === "GET" && path === "/daily-summary") {
      const date = url.searchParams.get("date") ?? todayDate();
      const project = url.searchParams.get("project") ?? undefined;
      const summary = service.getSummary(date, project);
      if (!summary) return json(null);
      return json(summary);
    }

    // ── GET /daily-summary/recent ─────────────────────────────────────────
    if (method === "GET" && path === "/daily-summary/recent") {
      const limit = url.searchParams.has("limit")
        ? Number(url.searchParams.get("limit"))
        : 30;
      return json(service.listRecent(limit));
    }

    // ── GET /daily-summary/context?date=YYYY-MM-DD&project=xxx ────────────
    if (method === "GET" && path === "/daily-summary/context") {
      const date = url.searchParams.get("date") ?? todayDate();
      const project = url.searchParams.get("project") ?? undefined;
      return json(service.getContextForDate(date, project));
    }

    // ── POST /daily-summary ───────────────────────────────────────────────
    if (method === "POST" && path === "/daily-summary") {
      const body = await parseBody(req);
      const content = body["content"] as string | undefined;
      if (!content) return jsonError("Campo requerido: content");

      const summary = service.saveSummary({
        date: (body["date"] as string | undefined) ?? todayDate(),
        project: (body["project"] as string | null | undefined) ?? null,
        title: (body["title"] as string | null | undefined) ?? null,
        content,
        source: (body["source"] as DailySummarySource | undefined) ?? "MANUAL",
      });
      return json(summary, 201);
    }

    // ── POST /daily-summary/generate ─────────────────────────────────────────
    if (method === "POST" && path === "/daily-summary/generate") {
      const body = await parseBody(req);
      const date = (body["date"] as string | undefined) ?? todayDate();
      const project = body["project"] as string | undefined;

      try {
        const result = await generator.generate(date, project);
        return json(result, 201);
      } catch (err) {
        const msg = String(err);
        if (msg.includes("API_KEY_MISSING")) {
          const friendly = msg.replace(/^Error:\s*API_KEY_MISSING:\s*/i, "");
          return jsonError(friendly, 422);
        }
        console.error("[generate] Error:", err);
        return jsonError(
          "No se pudo generar el resumen. Revisá tu conexión o intentá nuevamente.",
          500
        );
      }
    }

    return jsonError("Ruta no encontrada", 404);
  };
}
