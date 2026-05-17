import type { SettingsRepository } from "../repository/settings-repository.ts";
import type { NgrokTunnelService } from "../service/ngrok-tunnel-service.ts";

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

function maskToken(token: string | null): string {
  if (!token) return "";
  if (token.length <= 8) return "•".repeat(token.length);
  return token.slice(0, 4) + "•".repeat(token.length - 8) + token.slice(-4);
}

export function createSettingsHandler(
  repo: SettingsRepository,
  ngrok: NgrokTunnelService,
  serverPort: number
) {
  return async function handleSettingsRequest(
    req: Request
  ): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method.toUpperCase();

    // ── GET /api/health ───────────────────────────────────────────────────────
    if (method === "GET" && path === "/api/health") {
      const ngrokState = ngrok.state;
      return json({
        mcp: {
          status: "ok",
          endpoint: `http://localhost:${serverPort}/mcp`,
        },
        ngrok: {
          status: ngrokState.status,
          publicUrl: ngrokState.publicUrl,
          pid: ngrokState.pid,
        },
      });
    }

    // ── GET /api/settings ─────────────────────────────────────────────────────
    if (method === "GET" && path === "/api/settings") {
      const rawToken = repo.get("ngrok_authtoken");
      return json({
        ngrokAuthtoken: maskToken(rawToken),
        ngrokAuthtokenConfigured: !!rawToken,
        ngrokDevDomain: repo.get("ngrok_dev_domain") ?? "",
        ngrokAutostart: repo.get("ngrok_autostart") === "true",
        ngrokBinaryPath: repo.get("ngrok_binary_path") ?? "",
        chatgptProjectUrl: repo.get("chatgpt_project_url") ?? "",
      });
    }

    // ── POST /api/settings ────────────────────────────────────────────────────
    if (method === "POST" && path === "/api/settings") {
      const body = await parseBody(req);

      // Solo actualizar el token si viene un valor no-mascarado (sin •)
      const incomingToken = body["ngrokAuthtoken"] as string | undefined;
      if (incomingToken !== undefined && !incomingToken.includes("•")) {
        if (incomingToken.trim() === "") {
          repo.delete("ngrok_authtoken");
        } else {
          repo.set("ngrok_authtoken", incomingToken.trim());
        }
      }

      const domain = body["ngrokDevDomain"] as string | undefined;
      if (domain !== undefined) {
        if (domain.trim() === "") {
          repo.delete("ngrok_dev_domain");
        } else {
          repo.set("ngrok_dev_domain", stripProtocol(domain));
        }
      }

      const autostart = body["ngrokAutostart"];
      if (autostart !== undefined) {
        repo.set("ngrok_autostart", String(!!autostart));
      }

      const binaryPath = body["ngrokBinaryPath"] as string | undefined;
      if (binaryPath !== undefined) {
        if (binaryPath.trim() === "") {
          repo.delete("ngrok_binary_path");
        } else {
          repo.set("ngrok_binary_path", binaryPath.trim());
        }
      }

      const projectUrl = body["chatgptProjectUrl"] as string | undefined;
      if (projectUrl !== undefined) {
        if (projectUrl.trim() === "") {
          repo.delete("chatgpt_project_url");
        } else {
          repo.set("chatgpt_project_url", projectUrl.trim());
        }
      }

      ngrok.refreshConfig();

      const rawToken = repo.get("ngrok_authtoken");
      return json({
        ok: true,
        ngrokAuthtoken: maskToken(rawToken),
        ngrokAuthtokenConfigured: !!rawToken,
        ngrokDevDomain: repo.get("ngrok_dev_domain") ?? "",
        ngrokAutostart: repo.get("ngrok_autostart") === "true",
        ngrokBinaryPath: repo.get("ngrok_binary_path") ?? "",
        chatgptProjectUrl: repo.get("chatgpt_project_url") ?? "",
      });
    }

    // ── GET /api/settings/ngrok/status ────────────────────────────────────────
    if (method === "GET" && path === "/api/settings/ngrok/status") {
      return json(ngrok.state);
    }

    // ── POST /api/settings/ngrok/start ────────────────────────────────────────
    if (method === "POST" && path === "/api/settings/ngrok/start") {
      await ngrok.start(serverPort);
      return json(ngrok.state);
    }

    // ── POST /api/settings/ngrok/stop ─────────────────────────────────────────
    if (method === "POST" && path === "/api/settings/ngrok/stop") {
      ngrok.stop();
      return json(ngrok.state);
    }

    // ── GET /api/settings/ai ──────────────────────────────────────────────────
    if (method === "GET" && path === "/api/settings/ai") {
      return json(readAISettings(repo));
    }

    // ── POST /api/settings/ai ─────────────────────────────────────────────────
    if (method === "POST" && path === "/api/settings/ai") {
      const body = await parseBody(req);

      const aiProvider = body["aiProvider"] as string | undefined;
      if (aiProvider !== undefined) {
        if (aiProvider.trim() === "") {
          repo.delete("ai_provider");
        } else {
          repo.set("ai_provider", aiProvider.trim());
        }
      }

      const openaiKey = body["openaiApiKey"] as string | undefined;
      if (openaiKey !== undefined && !openaiKey.includes("•")) {
        if (openaiKey.trim() === "") {
          repo.delete("openai_api_key");
        } else {
          repo.set("openai_api_key", openaiKey.trim());
        }
      }

      const openaiModel = body["openaiModel"] as string | undefined;
      if (openaiModel !== undefined) {
        repo.set("openai_model", openaiModel.trim() || "gpt-4o-mini");
      }

      const anthropicKey = body["anthropicApiKey"] as string | undefined;
      if (anthropicKey !== undefined && !anthropicKey.includes("•")) {
        if (anthropicKey.trim() === "") {
          repo.delete("anthropic_api_key");
        } else {
          repo.set("anthropic_api_key", anthropicKey.trim());
        }
      }

      const anthropicModel = body["anthropicModel"] as string | undefined;
      if (anthropicModel !== undefined) {
        repo.set("anthropic_model", anthropicModel.trim() || "claude-sonnet-4-6");
      }

      return json(readAISettings(repo));
    }

    return jsonError("Ruta no encontrada", 404);
  };
}

function stripProtocol(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

function readAISettings(repo: SettingsRepository) {
  const rawOpenaiKey = repo.get("openai_api_key");
  const rawAnthropicKey = repo.get("anthropic_api_key");
  return {
    aiProvider: repo.get("ai_provider") ?? "",
    openaiApiKeyConfigured: !!rawOpenaiKey,
    openaiApiKey: maskToken(rawOpenaiKey),
    openaiModel: repo.get("openai_model") ?? "gpt-4o-mini",
    anthropicApiKeyConfigured: !!rawAnthropicKey,
    anthropicApiKey: maskToken(rawAnthropicKey),
    anthropicModel: repo.get("anthropic_model") ?? "claude-sonnet-4-6",
  };
}
