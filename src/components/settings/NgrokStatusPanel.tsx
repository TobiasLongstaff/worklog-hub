import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Clipboard, Check } from "lucide-react";
import type { NgrokState } from "@/lib/types";

interface NgrokStatusPanelProps {
  state: NgrokState;
  onStart: () => void;
  onStop: () => void;
}

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

function isNotInstalled(msg: string | null): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes("not found in $path") ||
    lower.includes("executable not found") ||
    lower.includes("program not found") ||
    lower.includes("no se pudo ejecutar ngrok")
  );
}

const slide = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.2, ease: EASE },
};

function Dot({ className }: { className: string }) {
  return <span className={cn("size-2 rounded-full shrink-0", className)} />;
}

export function NgrokStatusPanel({ state, onStart, onStop }: NgrokStatusPanelProps) {
  const [copied, setCopied] = useState(false);

  async function copyMcp() {
    if (!state.publicUrl) return;
    const url = `${state.publicUrl}/mcp`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("URL copiada al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <AnimatePresence mode="wait">
      {state.status === "NOT_CONFIGURED" && (
        <motion.div key="not-configured" {...slide}>
          <div className="flex items-center gap-2">
            <Dot className="bg-muted-foreground/50" />
            <span className="text-sm text-muted-foreground">No configurado</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Configurá el authtoken y el dominio para activar el túnel.
          </p>
        </motion.div>
      )}

      {state.status === "STOPPED" && (
        <motion.div key="stopped" {...slide} className="flex items-center gap-2">
          <Dot className="bg-muted-foreground" />
          <span className="text-sm text-muted-foreground">Detenido</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={onStart}>
            Iniciar
          </Button>
        </motion.div>
      )}

      {state.status === "STARTING" && (
        <motion.div key="starting" {...slide}>
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex size-full rounded-full bg-warning opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-warning" />
            </span>
            <span className="text-sm text-warning font-medium">Iniciando…</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Estableciendo el túnel, esto puede tardar hasta 20 segundos.
          </p>
        </motion.div>
      )}

      {state.status === "ACTIVE" && state.publicUrl && (
        <motion.div key="active" {...slide}>
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex size-full rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success shadow-[0_0_8px_currentColor]" />
            </span>
            <span className="text-sm text-success font-medium">Activo</span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={onStop}>
              Detener
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-3 p-3 rounded-lg border bg-muted/30">
            <code className="flex-1 text-xs font-mono break-all">{state.publicUrl}/mcp</code>
            <Button size="sm" className="gap-1.5 shrink-0" onClick={copyMcp}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={copied ? "check" : "copy"}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-1.5"
                >
                  {copied ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />}
                  {copied ? "Copiado" : "Copiar URL MCP"}
                </motion.span>
              </AnimatePresence>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Usá esta URL para crear el conector MCP en ChatGPT. Mientras Worklog Hub esté abierto, la
            conexión estará disponible.
            <br />
            El dominio es estable: no necesitás reconfigurar el conector al reiniciar.
          </p>
        </motion.div>
      )}

      {state.status === "ERROR" && (
        <motion.div key="error" {...slide}>
          <div className="flex items-center gap-2">
            <Dot className="bg-destructive" />
            <span className="text-sm text-destructive font-medium">Error</span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={onStart}>
              Reintentar
            </Button>
          </div>
          {isNotInstalled(state.errorMessage) ? (
            <div className="mt-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-1.5">
              <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                ngrok no está instalado en este equipo
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">
                Descargá el ejecutable gratuito desde{" "}
                <a
                  href="https://ngrok.com/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium hover:underline"
                >
                  ngrok.com/download
                </a>
                {" "}(Windows x64) y descomprimí el{" "}
                <code className="text-[11px] bg-muted px-1 rounded">ngrok.exe</code>.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Después podés agregarlo al PATH o poner la ruta completa en{" "}
                <strong>Opciones avanzadas → Ruta al ejecutable</strong>.
              </p>
            </div>
          ) : (
            <div className="mt-3 p-3 rounded-lg border border-destructive/30 bg-destructive/10">
              <div className="text-sm font-medium text-destructive">
                No se pudo establecer el túnel ngrok.
              </div>
              <div className="font-mono text-xs mt-1 break-all text-destructive/80">
                {(state.errorMessage || "Error desconocido").replace(/authtoken=\S+/g, "authtoken=***")}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
