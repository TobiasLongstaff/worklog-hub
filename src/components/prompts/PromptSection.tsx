import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
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
import { fmtDate, fmtDateShort, cn } from "@/lib/utils";
import { TargetRepoBadge } from "@/components/backlog/StatusBadges";
import { EmptyState } from "@/components/shared/EmptyState";
import type { BacklogItem, BacklogPrompt, PromptType, TargetRepo } from "@/lib/types";
import {
  Bot,
  Check,
  ChevronDown,
  Clipboard,
  History,
  RefreshCw,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";

interface PromptSectionProps {
  item: BacklogItem;
  prompts: BacklogPrompt[];
  onRegenerated: () => void;
  onOpenRegenerate: () => void;
  onOpenDispatch: (promptId: string, agent: "OPENCODE" | "CLAUDE_CODE") => void;
  onOpenHistory: (content: string) => void;
}

const TYPE_TINT: Record<PromptType, string> = {
  IMPLEMENTATION: "bg-primary/15 text-primary",
  AUDIT: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  INVESTIGATION: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  STRATEGY: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
};

const TYPE_LABEL: Record<PromptType, string> = {
  IMPLEMENTATION: "Implementación",
  AUDIT: "Auditoría",
  INVESTIGATION: "Investigación",
  STRATEGY: "Estrategia",
};

function defaultsFor(item: BacklogItem): { target: TargetRepo; type: PromptType } {
  const target: TargetRepo =
    item.area === "FRONTEND" ? "FRONTEND" : item.area === "BACKEND" ? "BACKEND" : "FULLSTACK";

  const type: PromptType =
    item.type === "OPEN_DECISION"
      ? "STRATEGY"
      : item.type === "VALIDATION_PENDING"
      ? "AUDIT"
      : item.type === "IDEA"
      ? "STRATEGY"
      : "IMPLEMENTATION";

  return { target, type };
}

export function PromptSection({
  item,
  prompts,
  onRegenerated,
  onOpenRegenerate,
  onOpenDispatch,
  onOpenHistory,
}: PromptSectionProps) {
  const defs = defaultsFor(item);
  const [target, setTarget] = useState<TargetRepo>(defs.target);
  const [promptType, setPromptType] = useState<PromptType>(defs.type);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const activePrompt = prompts.find((p) => p.isActive) ?? null;
  const historyPrompts = prompts.filter((p) => !p.isActive);

  async function generate() {
    setGenerating(true);
    try {
      await API.generatePrompt(item.id, { targetRepo: target, promptType });
      toast.success("Prompt generado");
      onRegenerated();
    } catch (e) {
      toast.error(`Error generando prompt: ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }

  async function copy(p: BacklogPrompt) {
    try {
      await navigator.clipboard.writeText(p.content);
      setCopiedId(p.id);
      toast.success("Prompt copiado al portapapeles");
      setTimeout(() => setCopiedId((cur) => (cur === p.id ? null : cur)), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <div className="mt-1">
      <AnimatePresence mode="wait" initial={false}>
        {!activePrompt ? (
          <motion.div
            key="no-prompt"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-5">
              <EmptyState
                compact
                icon={<Sparkles className="size-5 text-primary" />}
                title="Sin prompt generado"
                description="Generá un prompt técnico para resolver este pendiente con un agente de código."
              />
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <Select value={target} onValueChange={(v) => setTarget(v as TargetRepo)}>
                  <SelectTrigger className="w-[160px] h-8 text-xs bg-card">
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
                <Select value={promptType} onValueChange={(v) => setPromptType(v as PromptType)}>
                  <SelectTrigger className="w-[160px] h-8 text-xs bg-card">
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
                <Button size="sm" onClick={generate} disabled={generating} className="gap-1.5">
                  <Wand2 className="size-3.5" />
                  {generating ? "Generando…" : "Generar prompt"}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`prompt-${activePrompt.id}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-[0_1px_2px_0_rgb(0_0_0_/_0.02)]">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/60 bg-muted/20">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        TYPE_TINT[activePrompt.promptType]
                      )}
                    >
                      <Sparkles className="size-3" />
                      {TYPE_LABEL[activePrompt.promptType]}
                    </span>
                    <TargetRepoBadge target={activePrompt.targetRepo} />
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {fmtDate(activePrompt.createdAt)}
                    </span>
                  </div>
                  <div className="font-semibold text-[13px] leading-tight tracking-tight text-foreground truncate">
                    {activePrompt.title}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-4 py-3">
                <pre className="text-[11.5px] bg-muted/40 border border-border/60 p-3 rounded-lg whitespace-pre-wrap max-h-72 overflow-y-auto scrollbar-thin font-mono leading-relaxed text-foreground/85">
                  {activePrompt.content}
                </pre>
              </div>

              {/* Footer actions */}
              <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 border-t border-border/60 bg-muted/10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(activePrompt)}
                  className="h-8 gap-1.5"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={copiedId === activePrompt.id ? "check" : "copy"}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ duration: 0.15 }}
                      className="inline-flex"
                    >
                      {copiedId === activePrompt.id ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Clipboard className="size-3.5" />
                      )}
                    </motion.span>
                  </AnimatePresence>
                  {copiedId === activePrompt.id ? "Copiado" : "Copiar"}
                </Button>

                <Button
                  size="sm"
                  onClick={() => onOpenDispatch(activePrompt.id, "OPENCODE")}
                  className="h-8 gap-1.5"
                >
                  <Send className="size-3.5" />
                  → OpenCode
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onOpenDispatch(activePrompt.id, "CLAUDE_CODE")}
                  className="h-8 gap-1.5"
                >
                  <Bot className="size-3.5" />
                  → Claude Code
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onOpenRegenerate}
                  className="h-8 gap-1.5 ml-auto"
                >
                  <RefreshCw className="size-3.5" />
                  Regenerar
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History (collapsible) */}
      {historyPrompts.length > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            <History className="size-3" />
            <span>Versiones anteriores ({historyPrompts.length})</span>
            <ChevronDown
              className={cn(
                "size-3 transition-transform",
                historyOpen && "rotate-180"
              )}
            />
          </button>
          <AnimatePresence initial={false}>
            {historyOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-1 mt-2">
                  {historyPrompts.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onOpenHistory(p.content)}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md hover:bg-accent/50 text-[12px] transition-colors text-left border border-transparent hover:border-border/40"
                    >
                      <span className="truncate text-foreground/80">{p.title}</span>
                      <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                        {fmtDateShort(p.createdAt)}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  );
}
