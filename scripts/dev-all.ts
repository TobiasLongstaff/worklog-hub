/**
 * Script orquestador de desarrollo.
 * Levanta el servidor backlog en segundo plano y luego inicia el frontend.
 *
 *   bun scripts/dev-all.ts           → Tauri dev (app de escritorio)
 *   bun scripts/dev-all.ts --web     → Vite solo (navegador)
 */

import { readdirSync, existsSync } from "fs";
import { join } from "path";

const isWeb = process.argv.includes("--web");
const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

// ── Inyectar herramientas de compilación en PATH (Windows) ────────────────
// Necesario porque PowerShell no siempre carga el user PATH correctamente,
// y cargo requiere además el linker de MSVC para compilar código Rust.
if (process.platform === "win32") {
  const home = process.env.USERPROFILE ?? "";

  // 1. cargo
  const cargoBin = `${home}\\.cargo\\bin`;
  if (!process.env.PATH?.includes(cargoBin)) {
    process.env.PATH = `${cargoBin};${process.env.PATH ?? ""}`;
  }

  // 2. MSVC linker (link.exe) — necesario para que cargo pueda compilar
  const msvcBin = findMsvcBin();
  if (msvcBin && !process.env.PATH?.includes(msvcBin)) {
    process.env.PATH = `${msvcBin};${process.env.PATH}`;
  }

  // 3. Microsoft Store app aliases (ngrok, etc.) — Store instala aquí pero
  //    Bun no hereda este segmento del PATH de usuario al lanzar subprocesos.
  const storeApps = `${home}\\AppData\\Local\\Microsoft\\WindowsApps`;
  if (!process.env.PATH?.includes("WindowsApps")) {
    process.env.PATH = `${storeApps};${process.env.PATH}`;
  }
}

// ── 1. Levantar servidor backlog en background ────────────────────────────
const server = Bun.spawn(["bun", "scripts/backlog-server.ts"], {
  cwd: ROOT,
  stdout: "inherit",
  stderr: "inherit",
  env: process.env,
});

// ── 2. Esperar a que el servidor esté listo ───────────────────────────────
process.stdout.write("\n  Esperando servidor backlog");
const ready = await waitForHealth("http://localhost:3131/api/health", 20_000);
if (!ready) {
  process.stdout.write("\n");
  console.error("  [dev-all] El servidor no respondió en 20 s. Revisá los errores arriba.");
  server.kill();
  process.exit(1);
}
process.stdout.write(" ✓\n\n");

// ── 3. Levantar frontend ──────────────────────────────────────────────────
const frontendCmd = isWeb ? ["bunx", "vite"] : ["bunx", "tauri", "dev"];

const frontend = Bun.spawn(frontendCmd, {
  cwd: ROOT,
  stdout: "inherit",
  stderr: "inherit",
  env: process.env,
});

// ── 4. Cleanup al salir ───────────────────────────────────────────────────
function cleanup() {
  try { frontend.kill(); } catch {}
  try { server.kill(); } catch {}
}

process.on("SIGINT",  () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });
process.on("exit", cleanup);

await frontend.exited;
server.kill();

// ── Helpers ───────────────────────────────────────────────────────────────

async function waitForHealth(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // aún no disponible
    }
    process.stdout.write(".");
    await Bun.sleep(400);
  }
  return false;
}

function findMsvcBin(): string | null {
  const bases = [
    "C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC",
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC",
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Tools\\MSVC",
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\Tools\\MSVC",
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\VC\\Tools\\MSVC",
  ];

  for (const base of bases) {
    if (!existsSync(base)) continue;
    try {
      const versions = readdirSync(base).filter(Boolean).sort();
      if (versions.length === 0) continue;
      const latest = versions[versions.length - 1]!;
      const bin = join(base, latest, "bin", "Hostx64", "x64");
      if (existsSync(join(bin, "link.exe"))) return bin;
    } catch {
      continue;
    }
  }
  return null;
}
