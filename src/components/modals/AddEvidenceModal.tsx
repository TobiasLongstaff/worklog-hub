import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { EVIDENCE_TYPES } from "@/lib/constants";

interface AddEvidenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  onAdded: () => void;
}

export function AddEvidenceModal({ open, onOpenChange, itemId, onAdded }: AddEvidenceModalProps) {
  const [type, setType] = useState<string>(EVIDENCE_TYPES[0]);
  const [summary, setSummary] = useState("");
  const [ref, setRef] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setType(EVIDENCE_TYPES[0]);
    setSummary("");
    setRef("");
  }

  async function submit() {
    if (!itemId) return;
    if (!summary.trim()) {
      toast.error("El resumen es obligatorio");
      return;
    }
    setSubmitting(true);
    try {
      await API.addEvidence(itemId, { type, summary: summary.trim(), rawReference: ref.trim() || undefined });
      toast.success("Evidencia agregada");
      reset();
      onOpenChange(false);
      onAdded();
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar evidencia</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>
              Tipo <span className="text-destructive">*</span>
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVIDENCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>
              Resumen <span className="text-destructive">*</span>
            </Label>
            <Textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Describe qué evidencia es y qué indica"
            />
          </div>

          <div className="grid gap-2">
            <Label>Referencia (path, URL, commit hash…)</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
