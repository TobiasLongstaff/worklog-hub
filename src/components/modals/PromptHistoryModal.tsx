import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Clipboard } from "lucide-react";

interface PromptHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string | null;
}

export function PromptHistoryModal({ open, onOpenChange, content }: PromptHistoryModalProps) {
  async function copy() {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Prompt copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Versión anterior del prompt</DialogTitle>
        </DialogHeader>

        <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap max-h-[420px] overflow-y-auto scrollbar-thin font-mono">
          {content ?? ""}
        </pre>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={copy}>
            <Clipboard className="size-3.5" />
            Copiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
