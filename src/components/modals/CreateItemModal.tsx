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
import { TYPE_LABELS, AREA_LABELS } from "@/lib/constants";
import type { BacklogArea, BacklogItem, BacklogType } from "@/lib/types";

const NONE = "__none__";

interface CreateItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (item: BacklogItem) => void;
}

export function CreateItemModal({ open, onOpenChange, onCreated }: CreateItemModalProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<BacklogType>("BUG");
  const [area, setArea] = useState<string>("");
  const [project, setProject] = useState("");
  const [module, setModule] = useState("");
  const [description, setDescription] = useState("");
  const [context, setContext] = useState("");
  const [why, setWhy] = useState("");
  const [next, setNext] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTitle("");
    setType("BUG");
    setArea("");
    setProject("");
    setModule("");
    setDescription("");
    setContext("");
    setWhy("");
    setNext("");
  }

  async function submit() {
    if (!title.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    setSubmitting(true);
    try {
      const item = await API.createItem({
        title: title.trim(),
        type,
        source: "MANUAL",
        description: description.trim() || undefined,
        originContext: context.trim() || undefined,
        project: project.trim() || undefined,
        module: module.trim() || undefined,
        area: (area as BacklogArea) || undefined,
        whyItMatters: why.trim() || undefined,
        suggestedNextStep: next.trim() || undefined,
      });
      toast.success("Pendiente creado");
      reset();
      onOpenChange(false);
      onCreated(item);
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
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Nuevo pendiente</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Descripción corta del pendiente"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>
                Tipo <span className="text-destructive">*</span>
              </Label>
              <Select value={type} onValueChange={(v) => setType(v as BacklogType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Área</Label>
              <Select
                value={area === "" ? NONE : area}
                onValueChange={(v) => setArea(v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {Object.entries(AREA_LABELS)
                    .filter(([v]) => v !== "UNKNOWN")
                    .map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Proyecto</Label>
              <Input
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="ej: facturacion-system"
              />
            </div>
            <div className="grid gap-2">
              <Label>Módulo</Label>
              <Input
                value={module}
                onChange={(e) => setModule(e.target.value)}
                placeholder="ej: Cheques"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Descripción</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describí el problema o pendiente con detalle"
            />
          </div>

          <div className="grid gap-2">
            <Label>Contexto de origen</Label>
            <Textarea
              rows={2}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="¿Dónde o cómo surgió este pendiente?"
            />
          </div>

          <div className="grid gap-2">
            <Label>Por qué importa</Label>
            <Input
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Impacto o riesgo si no se resuelve"
            />
          </div>

          <div className="grid gap-2">
            <Label>Siguiente paso sugerido</Label>
            <Input
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="Próxima acción concreta recomendada"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            Crear pendiente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
