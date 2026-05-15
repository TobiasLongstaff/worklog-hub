import type { SettingsRepository } from "../repository/settings-repository.ts";

export type NgrokStatus =
  | "NOT_CONFIGURED"
  | "STOPPED"
  | "STARTING"
  | "ACTIVE"
  | "ERROR";

export interface NgrokState {
  status: NgrokStatus;
  /** URL pública completa del endpoint MCP, e.g. "https://abc.ngrok-free.app/mcp" */
  publicUrl: string | null;
  errorMessage: string | null;
  pid: number | null;
}

interface NgrokTunnelEntry {
  public_url: string;
  proto: string;
}

interface NgrokApiResponse {
  tunnels: NgrokTunnelEntry[];
}

export class NgrokTunnelService {
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private _state: NgrokState;

  constructor(private readonly repo: SettingsRepository) {
    const configured = !!(
      repo.get("ngrok_authtoken") && repo.get("ngrok_dev_domain")
    );
    this._state = {
      status: configured ? "STOPPED" : "NOT_CONFIGURED",
      publicUrl: null,
      errorMessage: null,
      pid: null,
    };
  }

  get state(): Readonly<NgrokState> {
    // Si creemos que está activo pero el proceso murió, actualizamos
    if (
      this._state.status === "ACTIVE" &&
      this.proc !== null &&
      !this.isProcessAlive()
    ) {
      this._state = {
        status: "ERROR",
        publicUrl: null,
        errorMessage: "El proceso de ngrok terminó inesperadamente.",
        pid: null,
      };
      this.proc = null;
    }
    return { ...this._state };
  }

  async start(port = 3131): Promise<void> {
    const token = this.repo.get("ngrok_authtoken");
    const rawDomain = this.repo.get("ngrok_dev_domain") ?? "";
    const domain = rawDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
    const binaryPath = this.repo.get("ngrok_binary_path") ?? resolveNgrokBinary();

    if (!token || !domain) {
      this._state = {
        status: "NOT_CONFIGURED",
        publicUrl: null,
        errorMessage: "Configurá el authtoken y el dominio en Settings.",
        pid: null,
      };
      return;
    }

    if (
      this._state.status === "ACTIVE" ||
      this._state.status === "STARTING"
    ) {
      return;
    }

    this.stop();

    this._state = {
      status: "STARTING",
      publicUrl: null,
      errorMessage: null,
      pid: null,
    };

    const ngrokArgs = [
      "http",
      `--authtoken=${token}`,
      `--domain=${domain}`,
      String(port),
    ];

    // En Windows, las apps instaladas desde la Microsoft Store son reparse points
    // que solo cmd.exe sabe resolver. Si el path no es absoluto, envolvemos en cmd /c.
    const spawnArgs: string[] =
      process.platform === "win32" && !binaryPath.includes("\\") && !binaryPath.includes("/")
        ? ["cmd", "/c", binaryPath, ...ngrokArgs]
        : [binaryPath, ...ngrokArgs];

    try {
      this.proc = Bun.spawn(spawnArgs, { stdout: "pipe", stderr: "pipe", stdin: null });
      this._state.pid = this.proc.pid;
    } catch (err) {
      this._state = {
        status: "ERROR",
        publicUrl: null,
        errorMessage: `No se pudo ejecutar ngrok: ${err}. Verificá que ngrok esté instalado (https://ngrok.com/download) y disponible en el PATH.`,
        pid: null,
      };
      return;
    }

    // Polling en segundo plano
    this.pollUntilActive(domain).catch(() => {});
  }

  stop(): void {
    if (this.proc) {
      try {
        this.proc.kill();
      } catch {
        // proceso ya terminado
      }
      this.proc = null;
    }
    const configured = !!(
      this.repo.get("ngrok_authtoken") && this.repo.get("ngrok_dev_domain")
    );
    this._state = {
      status: configured ? "STOPPED" : "NOT_CONFIGURED",
      publicUrl: null,
      errorMessage: null,
      pid: null,
    };
  }

  refreshConfig(): void {
    const configured = !!(
      this.repo.get("ngrok_authtoken") && this.repo.get("ngrok_dev_domain")
    );
    if (!configured) {
      if (this._state.status !== "ACTIVE" && this._state.status !== "STARTING") {
        this._state = { ...this._state, status: "NOT_CONFIGURED" };
      }
    } else if (this._state.status === "NOT_CONFIGURED") {
      this._state = { ...this._state, status: "STOPPED" };
    }
  }

  private async pollUntilActive(
    domain: string,
    maxWaitMs = 20_000
  ): Promise<void> {
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      if (this.proc !== null && !this.isProcessAlive()) {
        this._state = {
          status: "ERROR",
          publicUrl: null,
          errorMessage:
            "ngrok terminó inesperadamente. Verificá el authtoken y el dominio.",
          pid: null,
        };
        this.proc = null;
        return;
      }

      try {
        const res = await fetch("http://127.0.0.1:4040/api/tunnels", {
          signal: AbortSignal.timeout(1500),
        });
        if (res.ok) {
          const data = (await res.json()) as NgrokApiResponse;
          const tunnel = data.tunnels.find((t) =>
            t.public_url.includes(domain)
          );
          if (tunnel) {
            this._state = {
              status: "ACTIVE",
              publicUrl: `https://${domain}/mcp`,
              errorMessage: null,
              pid: this.proc?.pid ?? null,
            };
            return;
          }
        }
      } catch {
        // API de ngrok aún no disponible, seguimos esperando
      }

      await new Promise<void>((r) => setTimeout(r, 1000));
    }

    if (this._state.status === "STARTING") {
      this._state = {
        status: "ERROR",
        publicUrl: null,
        errorMessage:
          "Timeout: ngrok no confirmó el túnel en 20 segundos. Revisá el authtoken y el dominio.",
        pid: null,
      };
    }
  }

  private isProcessAlive(): boolean {
    try {
      return this.proc?.exitCode === null;
    } catch {
      return false;
    }
  }
}

/**
 * Intenta encontrar ngrok en ubicaciones conocidas cuando no está en PATH.
 * Cubre instalaciones via Microsoft Store y ubicaciones comunes en Windows.
 */
function resolveNgrokBinary(): string {
  // En Windows con Store, el alias es un ReparsePoint de 0 bytes que solo
  // cmd.exe puede resolver. Devolvemos "ngrok" para que el llamador lo envuelva
  // en "cmd /c ngrok" y funcione con ambos tipos de instalación.
  return "ngrok";
}
