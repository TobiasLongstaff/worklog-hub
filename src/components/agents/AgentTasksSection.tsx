import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { API } from "@/lib/api";
import { AGENT_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/utils";
import { TargetRepoBadge, TaskStatusBadge } from "@/components/backlog/StatusBadges";
import type { AgentTask } from "@/lib/types";
import { Clipboard, Check, CheckCircle2, Terminal } from "lucide-react";
import { StatusIndicator } from "@/components/shared/StatusIndicator";

interface AgentTasksSectionProps {
  itemId: string;
  tasks: AgentTask[];
  onTaskUpdated: () => void;
}

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

const cardVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.25, ease: EASE },
  }),
};

export function AgentTasksSection({ itemId, tasks, onTaskUpdated }: AgentTasksSectionProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyCommand(task: AgentTask) {
    if (!task.agentCommand) return;
    try {
      await navigator.clipboard.writeText(task.agentCommand);
      setCopiedId(task.id);
      toast.success("Comando copiado");
      setTimeout(() => setCopiedId((cur) => (cur === task.id ? null : cur)), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  async function markSent(taskId: string) {
    try {
      await API.updateTaskStatus(itemId, taskId, "SENT");
      toast.success("Tarea marcada como enviada");
      onTaskUpdated();
    } catch (e) {
      toast.error(`Error: ${(e as Error).message}`);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {tasks.map((t, i) => (
        <motion.div
          key={t.id}
          custom={i}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="rounded-xl border bg-card/60 p-3 shadow-sm"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              {t.status === "RUNNING" ? (
                <StatusIndicator status="active" size="sm" />
              ) : t.status === "READY_TO_SEND" ? (
                <StatusIndicator status="starting" size="sm" />
              ) : (
                <div className="size-1.5 rounded-full bg-muted-foreground/40" />
              )}
              <span className="font-semibold text-sm">{AGENT_LABELS[t.agent] ?? t.agent}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TargetRepoBadge target={t.targetRepo} />
              <TaskStatusBadge status={t.status} />
            </div>
          </div>

          {/* Timestamps */}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mb-2">
            <span>Creada: {fmtDate(t.createdAt)}</span>
            {t.sentAt ? <span>Enviada: {fmtDate(t.sentAt)}</span> : null}
            {t.finishedAt ? <span>Finalizada: {fmtDate(t.finishedAt)}</span> : null}
          </div>

          {/* Command */}
          {t.agentCommand ? (
            <div className="mb-2.5">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                <Terminal className="size-3" />
                Comando a ejecutar
              </div>
              <code className="block bg-muted/80 border border-border/50 px-2.5 py-2 rounded-lg text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
                {t.agentCommand}
              </code>
            </div>
          ) : null}

          {/* Output */}
          {t.outputSummary ? (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-md px-2.5 py-2 mt-1.5">
              {t.outputSummary}
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-2.5">
            {t.agentCommand ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => copyCommand(t)}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={copiedId === t.id ? "check" : "copy"}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-1.5"
                  >
                    {copiedId === t.id ? (
                      <Check className="size-3" />
                    ) : (
                      <Clipboard className="size-3" />
                    )}
                    {copiedId === t.id ? "Copiado" : "Copiar comando"}
                  </motion.span>
                </AnimatePresence>
              </Button>
            ) : null}
            {t.status === "READY_TO_SEND" ? (
              <Button
                variant="success"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => markSent(t.id)}
              >
                <CheckCircle2 className="size-3" />
                Marcar como enviado
              </Button>
            ) : null}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
