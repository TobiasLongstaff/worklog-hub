import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Clipboard,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { DailySummaryAPI } from "@/lib/api";
import type { DailyContext, DailySummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/shared/FadeIn";
import { MarkdownContent } from "@/components/daily/MarkdownContent";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  return date.toISOString().slice(0, 10);
}

const SOURCE_LABEL: Record<string, string> = {
  CHATGPT_MCP: "ChatGPT vía MCP",
  OPENAI_API: "OpenAI API",
  ANTHROPIC_API: "Anthropic API",
  MANUAL: "Manual",
  API: "API",
};

// ── Context card (collapsible) ─────────────────────────────────────────────

function ContextSection({ ctx }: { ctx: DailyContext }) {
  const [open, setOpen] = useState(false);
  const total =
    ctx.createdItems.length +
    ctx.acceptedItems.length +
    ctx.verifiedItems.length +
    ctx.discardedItems.length;

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="size-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">Contexto del día</span>
          <span className="text-[11px] text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">
            {total} movimiento{total !== 1 ? "s" : ""}
          </span>
        </div>
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Detectados", v: ctx.createdItems.length, cls: "text-blue-500" },
                  { label: "Aceptados", v: ctx.acceptedItems.length, cls: "text-emerald-500" },
                  { label: "Verificados", v: ctx.verifiedItems.length, cls: "text-violet-500" },
                  { label: "Descartados", v: ctx.discardedItems.length, cls: "text-muted-foreground" },
                ].map(({ label, v, cls }) => (
                  <div key={label} className="rounded-lg bg-muted/40 border border-border/40 py-2">
                    <div className={cn("text-lg font-bold tabular-nums", cls)}>{v}</div>
                    <div className="text-[10px] text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Prompts: <strong className="text-foreground">{ctx.promptsGenerated}</strong></span>
                <span>Tareas: <strong className="text-foreground">{ctx.agentTasksCreated}</strong> creadas · <strong className="text-foreground">{ctx.agentTasksCompleted}</strong> completadas</span>
                <span>Inbox: <strong className="text-foreground">{ctx.detectedTotal}</strong></span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const LOADING_STEPS = [
  "Recolectando sesiones de OpenCode…",
  "Leyendo actividad de Claude Code…",
  "Revisando commits recientes…",
  "Analizando el backlog…",
  "Generando brief de continuidad…",
];

function useLoadingStep(active: boolean) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) { setStep(0); return; }
    const id = setInterval(() => setStep((s) => (s + 1) % LOADING_STEPS.length), 2200);
    return () => clearInterval(id);
  }, [active]);
  return LOADING_STEPS[step]!;
}

const DATA_SOURCES = [
  { label: "OpenCode", color: "bg-orange-400/70" },
  { label: "Claude Code", color: "bg-blue-400/70" },
  { label: "Git", color: "bg-emerald-400/70" },
  { label: "Backlog", color: "bg-violet-400/70" },
];

// ── Estado 1: sin resumen ─────────────────────────────────────────────────

function GenerateCTA({
  isToday,
  generating,
  error,
  context,
  onGenerate,
}: {
  isToday: boolean;
  generating: boolean;
  error: string | null;
  context: DailyContext | null;
  onGenerate: () => void;
}) {
  const loadingStep = useLoadingStep(generating);

  const backlogTotal = context
    ? context.createdItems.length +
      context.acceptedItems.length +
      context.verifiedItems.length +
      context.discardedItems.length
    : 0;

  const chips = context
    ? [
        backlogTotal > 0 && {
          label: `${backlogTotal} mov. de backlog`,
          cls: "bg-violet-500/10 text-violet-400 border-violet-500/20",
        },
        context.agentTasksCreated > 0 && {
          label: `${context.agentTasksCreated} tarea${context.agentTasksCreated !== 1 ? "s" : ""} de agente`,
          cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        },
        context.promptsGenerated > 0 && {
          label: `${context.promptsGenerated} prompt${context.promptsGenerated !== 1 ? "s" : ""}`,
          cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        },
        context.detectedTotal > 0 && {
          label: `${context.detectedTotal} en inbox`,
          cls: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        },
      ].filter(Boolean)
    : [];

  return (
    <FadeIn className="rounded-2xl border border-border/60 bg-gradient-to-b from-card to-card/40 overflow-hidden">
      {/* Hero */}
      <div className="px-8 pt-10 pb-7 flex flex-col items-center text-center gap-5">
        {/* Icon */}
        <div className="relative">
          <div className="size-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 flex items-center justify-center shadow-lg">
            <Wand2 className="size-7 text-primary" />
          </div>
          <div className="absolute -inset-2 rounded-3xl bg-primary/8 blur-xl -z-10" />
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
            {isToday ? "Resumen para retomar" : "Sin resumen para esta fecha"}
          </h3>
          <p className="text-[13px] text-muted-foreground max-w-[340px] leading-relaxed">
            {isToday
              ? "Analiza la actividad reciente de agentes, backlog y commits para ayudarte a retomar el foco."
              : "No se encontró un resumen guardado. Podés navegar a otra fecha o volver a hoy para generar uno."}
          </p>
        </div>

        {/* Context chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {(chips as { label: string; cls: string }[]).map((chip) => (
              <span
                key={chip.label}
                className={cn(
                  "text-[11px] border rounded-full px-2.5 py-0.5 font-medium",
                  chip.cls
                )}
              >
                {chip.label}
              </span>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 flex items-start gap-2.5 text-left">
            <TriangleAlert className="size-3.5 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive leading-relaxed">{error}</p>
          </div>
        )}

        {/* Button */}
        {isToday && (
          <Button
            size="lg"
            onClick={onGenerate}
            disabled={generating}
            className="gap-2 min-w-[220px] relative"
          >
            {generating ? (
              <>
                <Loader2 className="size-4 animate-spin shrink-0" />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={loadingStep}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    className="truncate"
                  >
                    {loadingStep}
                  </motion.span>
                </AnimatePresence>
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generar resumen para retomar
              </>
            )}
          </Button>
        )}
      </div>

      {/* Footer: data sources */}
      {isToday && (
        <div className="mx-6 mb-6 rounded-xl bg-muted/25 border border-border/40 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Layers className="size-3 text-muted-foreground/70" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
              Fuentes analizadas
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {DATA_SOURCES.map((src) => (
              <span key={src.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", src.color)} />
                {src.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </FadeIn>
  );
}

// ── Estado 3: resumen generado ────────────────────────────────────────────

function SummaryDisplay({
  summary,
  generating,
  onRegenerate,
}: {
  summary: DailySummary;
  generating: boolean;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary.content);
      setCopied(true);
      toast.success("Resumen copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  const PREVIEW_SECTIONS = 3;
  const sectionCount = (summary.content.match(/^## /gm) ?? []).length;
  const hasMore = sectionCount > PREVIEW_SECTIONS;

  return (
    <FadeIn className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">
            {summary.title ?? "Resumen del día"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">
            {SOURCE_LABEL[summary.source] ?? summary.source}
            {summary.model ? ` · ${summary.model}` : ""}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-5">
        <MarkdownContent
          content={summary.content}
          maxSections={expanded ? undefined : PREVIEW_SECTIONS}
        />
        {hasMore && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-3 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
          >
            Ver completo ↓
          </button>
        )}
        {expanded && hasMore && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Colapsar ↑
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-border/40 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={copy} className="gap-1.5 h-7 text-xs">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? "check" : "copy"}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1.5"
            >
              {copied ? <Check className="size-3" /> : <Clipboard className="size-3" />}
              {copied ? "Copiado" : "Copiar"}
            </motion.span>
          </AnimatePresence>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onRegenerate}
          disabled={generating}
          className="gap-1.5 h-7 text-xs"
        >
          {generating ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          Regenerar
        </Button>
        <span className="ml-auto text-[10px] text-muted-foreground/60">
          {new Date(summary.updatedAt).toLocaleString("es-AR")}
        </span>
      </div>
    </FadeIn>
  );
}

// ── Historial reciente ────────────────────────────────────────────────────

function RecentList({
  items,
  activeDate,
  onSelect,
}: {
  items: DailySummary[];
  activeDate: string;
  onSelect: (date: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="text-xs text-muted-foreground/60 px-2 py-4 text-center">
        Sin historial aún
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
      <div className="px-4 py-2 border-b border-border/40">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Historial
        </span>
      </div>
      <div className="divide-y divide-border/40 max-h-[60vh] overflow-y-auto scrollbar-thin">
        {items.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.date)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors text-left cursor-pointer",
              s.date === activeDate && "bg-sidebar-accent"
            )}
          >
            <Calendar className="size-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium truncate">
                {s.title ?? formatDateLong(s.date)}
              </div>
              <div className="text-[10px] text-muted-foreground">{s.date}</div>
            </div>
            <span className="shrink-0 text-[9px] text-muted-foreground/60 uppercase">
              {s.source === "OPENAI_API" ? "GPT"
               : s.source === "ANTHROPIC_API" ? "ANT"
               : s.source === "CHATGPT_MCP" ? "MCP"
               : "MAN"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────

export function DailySummarySection() {
  const [date, setDate] = useState(todayDate());
  const [summary, setSummary] = useState<DailySummary | null | undefined>(undefined);
  const [context, setContext] = useState<DailyContext | null>(null);
  const [recent, setRecent] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setSummary(undefined);
    setGenerateError(null);
    try {
      const [s, r, ctx] = await Promise.all([
        DailySummaryAPI.get(d),
        DailySummaryAPI.listRecent(30),
        DailySummaryAPI.getContext(d),
      ]);
      setSummary(s);
      setRecent(r);
      setContext(ctx);
    } catch (e) {
      toast.error(`Error cargando resumen: ${(e as Error).message}`);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  async function generate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const result = await DailySummaryAPI.generate(date);
      setSummary(result);
      setRecent((prev) => {
        const filtered = prev.filter((s) => s.id !== result.id);
        return [result, ...filtered];
      });
      toast.success("Resumen generado y guardado");
    } catch (e) {
      const msg = (e as Error).message;
      setGenerateError(msg);
      toast.error(msg.length < 120 ? msg : "No se pudo generar el resumen");
    } finally {
      setGenerating(false);
    }
  }

  function goDay(delta: number) {
    setDate((prev) => addDays(prev, delta));
  }

  const isToday = date === todayDate();

  return (
    <div className="flex flex-col h-full">
      {/* Date nav bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goDay(-1)}
            className="size-7 rounded-lg border border-border/60 bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
          >
            <ChevronLeft className="size-4 text-muted-foreground" />
          </button>
          <div className="min-w-[220px] text-center">
            <div className="text-sm font-semibold capitalize">{formatDateLong(date)}</div>
            {isToday && (
              <div className="text-[10px] text-primary font-medium mt-0.5">hoy</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => goDay(1)}
            disabled={isToday}
            className="size-7 rounded-lg border border-border/60 bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(todayDate())}
              className="text-xs text-muted-foreground hover:text-foreground border border-border/60 rounded-lg px-2.5 py-1.5 hover:bg-muted/40 transition-colors cursor-pointer"
            >
              Ir a hoy
            </button>
          )}
          <button
            type="button"
            onClick={() => void load(date)}
            className="size-7 rounded-lg border border-border/60 bg-muted/40 flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
          >
            <RefreshCw className={cn("size-3.5 text-muted-foreground", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Content grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] min-h-full">
          {/* Main column */}
          <div className="px-6 py-5 space-y-4 border-r border-border/40">
            {/* Context card */}
            {context && <ContextSection ctx={context} />}

            {/* Summary area */}
            {loading ? (
              <div className="rounded-xl border border-border/60 bg-card/50 p-10 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" />
                Cargando…
              </div>
            ) : summary ? (
              <SummaryDisplay
                summary={summary}
                generating={generating}
                onRegenerate={generate}
              />
            ) : (
              <GenerateCTA
                isToday={isToday}
                generating={generating}
                error={generateError}
                context={context}
                onGenerate={generate}
              />
            )}
          </div>

          {/* Historial sidebar */}
          <div className="px-4 py-5">
            <RecentList items={recent} activeDate={date} onSelect={setDate} />
          </div>
        </div>
      </div>
    </div>
  );
}
