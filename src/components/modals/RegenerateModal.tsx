import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { API } from "@/lib/api";
import { TARGET_OPTS, PROMPT_TYPE_OPTS } from "@/lib/constants";
import type { PromptType, TargetRepo } from "@/lib/types";

interface RegenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  onDone: () => void;
}

export function RegenerateModal({ open, onOpenChange, itemId, onDone }: RegenerateModalProps) {
  const [target, setTarget] = useState<TargetRepo>("FULLSTACK");
  const [promptType, setPromptType] = useState<PromptType>("IMPLEMENTATION");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!itemId) return;
    setSubmitting(true);
    try {
      await API.generatePrompt(itemId, { targetRepo: target, promptType });
      toast.success("Prompt regenerado");
      onOpenChange(false);
      onDone();
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
          <DialogTitle>Regenerar prompt</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground mb-2">
          El prompt actual se conservará en el historial. Se generará uno nuevo con los parámetros
          que elijas.
        </p>

        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="grid gap-2">
            <Label>Repositorio destino</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as TargetRepo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Tipo de prompt</Label>
            <Select value={promptType} onValueChange={(v) => setPromptType(v as PromptType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROMPT_TYPE_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            Regenerar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
