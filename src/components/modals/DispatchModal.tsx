import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { API } from "@/lib/api";
import { AGENT_LABELS } from "@/lib/constants";
import type { AgentType } from "@/lib/types";

interface DispatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  promptId: string | null;
  agent: AgentType;
  onDispatched: () => void;
}

export function DispatchModal({
  open,
  onOpenChange,
  itemId,
  promptId,
  agent,
  onDispatched,
}: DispatchModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const agentLabel = AGENT_LABELS[agent];

  async function submit() {
    if (!itemId || !promptId) return;
    setSubmitting(true);
    try {
      await API.dispatchTask(itemId, { backlogPromptId: promptId, agent });
      toast.success("Tarea creada. Copiá el comando del panel para ejecutarla.");
      onOpenChange(false);
      onDispatched();
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar a {agentLabel}</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Se va a crear una tarea para <strong className="text-foreground">{agentLabel}</strong>.
            El prompt se guardará como archivo en{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">data/agent-tasks/</code> y se
            generará el comando para ejecutarlo en tu terminal.
          </p>
          <p>
            El ítem pasará a estado <em>En agente</em> automáticamente.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="warning" onClick={submit} disabled={submitting}>
            Crear tarea para {agentLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
