import { useEffect, useState, useCallback, useRef } from "react";
import { motion, type Variants } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { API } from "@/lib/api";
import { fmtDate } from "@/lib/utils";
import { AREA_LABELS, TYPE_LABELS } from "@/lib/constants";
import { StatusBadge, TypeBadge, SourceBadge } from "./StatusBadges";
import { getQuickActions, ACTION_STATUS_MAP } from "./quickActions";
import { PromptSection } from "@/components/prompts/PromptSection";
import { AgentTasksSection } from "@/components/agents/AgentTasksSection";
import type {
  AgentTask,
  BacklogItem,
  BacklogPrompt,
  BacklogType,
  Evidence,
} from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DetailPanelProps {
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemChanged: () => void;
  onOpenAddEvidence: (itemId: string) => void;
  onOpenRegenerate: (itemId: string) => void;
  onOpenDispatch: (itemId: string, promptId: string, agent: "OPENCODE" | "CLAUDE_CODE") => void;
  onOpenPromptHistory: (content: string) => void;
}

interface DetailData {
  item: BacklogItem;
  evidences: Evidence[];
  prompts: BacklogPrompt[];
  agentTasks: AgentTask[];
}

export function DetailPanel({
  itemId,
  open,
  onOpenChange,
  onItemChanged,
  onOpenAddEvidence,
  onOpenRegenerate,
  onOpenDispatch,
  onOpenPromptHistory,
}: DetailPanelProps) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState<BacklogType>("BUG");
  const [editModule, setEditModule] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNext, setEditNext] = useState("");
  const [saving, setSaving] = useState(false);

  const renderKey = useRef(0);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [item, evidences, prompts, agentTasks] = await Promise.all([
        API.getItem(id),
        API.getEvidences(id),
        API.getPrompts(id),
        API.getAgentTasks(id),
      ]);
      setData({ item, evidences, prompts, agentTasks });
      renderKey.current += 1;
      setEditTitle(item.title);
      setEditType(item.type);
      setEditModule(item.module ?? "");
      setEditDescription(item.description ?? "");
      setEditNext(item.suggestedNextStep ?? "");
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [onOpenChange]);

  useEffect(() => {
    if (open && itemId) {
      load(itemId);
    } else if (!open) {
      setData(null);
    }
  }, [open, itemId, load]);

  async function reload() {
    if (itemId) await load(itemId);
  }

  async function saveEdit() {
    if (!data) return;
    if (!editTitle.trim()) {
      toast.error("El título no puede estar vacío");
      return;
    }
    setSaving(true);
    try {
      await API.updateItem(data.item.id, {
        title: editTitle.trim(),
        type: editType,
        module: editModule.trim() || undefined,
        description: editDescription.trim() || undefined,
        suggestedNextStep: editNext.trim() || undefined,
      });
      toast.success("Cambios guardados");
      onItemChanged();
      reload();
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function quickAction(action: string) {
    if (!data) return;
    const newStatus = ACTION_STATUS_MAP[action as keyof typeof ACTION_STATUS_MAP];
    if (!newStatus) return;
    try {
      await API.transitionStatus(data.item.id, newStatus);
      toast.success("Estado actualizado");
      onItemChanged();
      onOpenChange(false);
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="p-0 flex flex-col">
        {loading || !data ? (
          <>
            <SheetHeader>
              <SheetTitle>Cargando…</SheetTitle>
            </SheetHeader>
            <div className="p-6 space-y-3 flex-1">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full mt-4" />
              <Skeleton className="h-24 w-full" />
            </div>
          </>
        ) : (
          <DetailContent
            key={renderKey.current}
            data={data}
            editTitle={editTitle}
            editType={editType}
            editModule={editModule}
            editDescription={editDescription}
            editNext={editNext}
            saving={saving}
            onEditTitle={setEditTitle}
            onEditType={setEditType}
            onEditModule={setEditModule}
            onEditDescription={setEditDescription}
            onEditNext={setEditNext}
            onSaveEdit={saveEdit}
            onQuickAction={quickAction}
            onAddEvidence={() => onOpenAddEvidence(data.item.id)}
            onPromptRegenerated={reload}
            onOpenRegenerate={() => onOpenRegenerate(data.item.id)}
            onOpenDispatch={(promptId, agent) => onOpenDispatch(data.item.id, promptId, agent)}
            onOpenPromptHistory={onOpenPromptHistory}
            onTaskUpdated={reload}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

interface DetailContentProps {
  data: DetailData;
  editTitle: string;
  editType: BacklogType;
  editModule: string;
  editDescription: string;
  editNext: string;
  saving: boolean;
  onEditTitle: (v: string) => void;
  onEditType: (v: BacklogType) => void;
  onEditModule: (v: string) => void;
  onEditDescription: (v: string) => void;
  onEditNext: (v: string) => void;
  onSaveEdit: () => void;
  onQuickAction: (action: string) => void;
  onAddEvidence: () => void;
  onPromptRegenerated: () => void;
  onOpenRegenerate: () => void;
  onOpenDispatch: (promptId: string, agent: "OPENCODE" | "CLAUDE_CODE") => void;
  onOpenPromptHistory: (content: string) => void;
  onTaskUpdated: () => void;
}

function DetailContent({
  data,
  editTitle,
  editType,
  editModule,
  editDescription,
  editNext,
  saving,
  onEditTitle,
  onEditType,
  onEditModule,
  onEditDescription,
  onEditNext,
  onSaveEdit,
  onQuickAction,
  onAddEvidence,
  onPromptRegenerated,
  onOpenRegenerate,
  onOpenDispatch,
  onOpenPromptHistory,
  onTaskUpdated,
}: DetailContentProps) {
  const { item, evidences, prompts, agentTasks } = data;
  const actions = getQuickActions(item);

  const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];
  const sectionVariants: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.045, duration: 0.28, ease: EASE },
    }),
  };

  return (
    <>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      >
        <SheetHeader className="pr-12 pb-0">
          <SheetTitle className="text-[17px] font-bold leading-snug">{item.title}</SheetTitle>
          <div className="flex flex-wrap gap-1.5 pt-2">
            <StatusBadge status={item.status} />
            <TypeBadge type={item.type} />
            <SourceBadge source={item.source} />
          </div>
        </SheetHeader>
      </motion.div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
        {/* Meta grid */}
        <motion.div custom={0} variants={sectionVariants} initial="hidden" animate="visible">
          <MetaGrid item={item} />
        </motion.div>

        {/* Descripción */}
        <AnimSection i={1} title="Descripción" variants={sectionVariants}>
          <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
            {item.description || <em className="text-muted-foreground">Sin descripción</em>}
          </div>
        </AnimSection>

        {/* Contexto */}
        <AnimSection i={2} title="Contexto de origen" variants={sectionVariants}>
          <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm whitespace-pre-wrap text-foreground/80 leading-relaxed">
            {item.originContext || <em className="text-muted-foreground">—</em>}
          </div>
        </AnimSection>

        {/* Por qué importa */}
        {item.whyItMatters ? (
          <AnimSection i={3} title="Por qué importa" variants={sectionVariants}>
            <div className="rounded-lg bg-accent/40 border border-accent-foreground/10 px-3 py-2.5 text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
              {item.whyItMatters}
            </div>
          </AnimSection>
        ) : null}

        {/* Siguiente paso */}
        {item.suggestedNextStep ? (
          <AnimSection i={4} title="Siguiente paso sugerido" variants={sectionVariants}>
            <div className="rounded-lg bg-primary/8 border border-primary/20 px-3 py-2.5 text-sm text-primary/90 font-medium leading-relaxed">
              → {item.suggestedNextStep}
            </div>
          </AnimSection>
        ) : null}

        {/* Fragmento */}
        {item.rawExcerpt ? (
          <AnimSection i={5} title="Fragmento original" variants={sectionVariants}>
            <pre className="text-xs bg-muted/60 p-3 rounded-lg whitespace-pre-wrap font-mono max-h-36 overflow-y-auto scrollbar-thin leading-relaxed">
              {item.rawExcerpt}
            </pre>
          </AnimSection>
        ) : null}

        {/* Evidencias */}
        <AnimSection i={6} title={`Evidencias (${evidences.length})`} variants={sectionVariants}>
          {evidences.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {evidences.map((ev) => (
                <div key={ev.id} className="rounded-lg border bg-card/60 px-3 py-2">
                  <div className="text-[10px] font-semibold text-primary uppercase tracking-widest">
                    {ev.type}
                  </div>
                  <div className="text-[13px] mt-0.5 leading-snug">{ev.summary}</div>
                  {ev.rawReference ? (
                    <div className="text-[11px] font-mono text-muted-foreground mt-1 break-all opacity-70">
                      {ev.rawReference}
                    </div>
                  ) : null}
                  <div className="text-[10px] text-muted-foreground mt-1">{fmtDate(ev.createdAt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground italic">Sin evidencias registradas.</p>
          )}
          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={onAddEvidence}>
            + Agregar evidencia
          </Button>
        </AnimSection>

        {/* Editar */}
        <AnimSection i={7} title="Editar" variants={sectionVariants}>
          <div className="flex flex-col gap-2.5">
            <div className="grid gap-1">
              <Label className="text-[11px]">Título</Label>
              <Input value={editTitle} onChange={(e) => onEditTitle(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label className="text-[11px]">Tipo</Label>
                <Select value={editType} onValueChange={(v) => onEditType(v as BacklogType)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-[11px]">Módulo</Label>
                <Input value={editModule} onChange={(e) => onEditModule(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-[11px]">Descripción</Label>
              <Textarea rows={3} value={editDescription} onChange={(e) => onEditDescription(e.target.value)} className="text-sm" />
            </div>
            <div className="grid gap-1">
              <Label className="text-[11px]">Siguiente paso</Label>
              <Input value={editNext} onChange={(e) => onEditNext(e.target.value)} className="h-8 text-sm" />
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs self-start" onClick={onSaveEdit} disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </AnimSection>

        {/* Historial */}
        <AnimSection i={8} title="Historial" variants={sectionVariants}>
          <div className="flex flex-col divide-y divide-border/50 rounded-lg border bg-card/40 overflow-hidden">
            {[
              { label: "Creado", value: fmtDate(item.createdAt) },
              { label: "Actualizado", value: fmtDate(item.updatedAt) },
              item.acceptedAt ? { label: "Aceptado", value: fmtDate(item.acceptedAt) } : null,
              item.verifiedAt ? { label: "Verificado", value: fmtDate(item.verifiedAt) } : null,
              item.discardedAt ? { label: "Descartado", value: fmtDate(item.discardedAt) } : null,
              item.reopenedAt ? { label: "Reabierto", value: fmtDate(item.reopenedAt) } : null,
            ].filter(Boolean).map((row) => (
              <div key={row!.label} className="flex items-center justify-between px-3 py-1.5 text-xs">
                <span className="text-muted-foreground">{row!.label}</span>
                <span className="font-medium">{row!.value}</span>
              </div>
            ))}
          </div>
        </AnimSection>

        {/* Vínculos */}
        {item.relatedCommitId || item.relatedAgentSessionId || item.relatedWorklogId ? (
          <AnimSection i={9} title="Vínculos" variants={sectionVariants}>
            <div className="flex flex-col divide-y divide-border/50 rounded-lg border bg-card/40 overflow-hidden">
              {item.relatedCommitId ? (
                <div className="flex items-center justify-between px-3 py-1.5 text-xs">
                  <span className="text-muted-foreground">Commit</span>
                  <span className="font-mono">{item.relatedCommitId}</span>
                </div>
              ) : null}
              {item.relatedAgentSessionId ? (
                <div className="flex items-center justify-between px-3 py-1.5 text-xs">
                  <span className="text-muted-foreground">Sesión agente</span>
                  <span className="font-mono">{item.relatedAgentSessionId.slice(0, 16)}…</span>
                </div>
              ) : null}
            </div>
          </AnimSection>
        ) : null}

        <Separator className="my-1" />

        {/* Prompts */}
        <motion.div custom={10} variants={sectionVariants} initial="hidden" animate="visible">
          <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">
            Resolver este pendiente
          </div>
          <PromptSection
            item={item}
            prompts={prompts}
            onRegenerated={onPromptRegenerated}
            onOpenRegenerate={onOpenRegenerate}
            onOpenDispatch={onOpenDispatch}
            onOpenHistory={onOpenPromptHistory}
          />
        </motion.div>

        {/* Agent tasks */}
        {agentTasks.length > 0 ? (
          <AnimSection i={11} title={`Tareas de agente (${agentTasks.length})`} variants={sectionVariants}>
            <AgentTasksSection itemId={item.id} tasks={agentTasks} onTaskUpdated={onTaskUpdated} />
          </AnimSection>
        ) : null}
      </div>

      {actions.length > 0 ? (
        <SheetFooter className="border-t bg-card/50 px-5 py-3">
          <div className="flex gap-2 w-full">
            {actions.map((a) => (
              <Button
                key={a.action}
                size="sm"
                className="flex-1 h-8"
                variant={a.variant === "danger" ? "destructive" : a.variant}
                onClick={() => onQuickAction(a.action)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </SheetFooter>
      ) : null}
    </>
  );
}

function AnimSection({
  i,
  title,
  children,
  variants,
}: {
  i: number;
  title: string;
  children: React.ReactNode;
  variants: Variants;
}) {
  return (
    <motion.div custom={i} variants={variants} initial="hidden" animate="visible">
      <Section title={title}>{children}</Section>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function MetaGrid({ item }: { item: BacklogItem }) {
  const cells = [
    { label: "Módulo", value: item.module || "—" },
    { label: "Área", value: item.area ? AREA_LABELS[item.area] || item.area : "—" },
    { label: "Proyecto", value: item.project || "—" },
    {
      label: "Confianza",
      value: item.confidence !== undefined && item.confidence !== null ? `${item.confidence}%` : "—",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {cells.map((c) => (
        <div key={c.label} className="rounded-md border bg-card/50 p-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {c.label}
          </div>
          <div className="text-sm font-medium mt-0.5 truncate">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function TimestampRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono" : ""}>{value}</span>
    </div>
  );
}
