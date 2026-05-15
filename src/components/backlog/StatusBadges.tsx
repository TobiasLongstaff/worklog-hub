import type {
  BacklogStatus,
  BacklogType,
  BacklogSource,
  AgentTaskStatus,
  TargetRepo,
} from "@/lib/types";
import {
  STATUS_LABELS,
  TYPE_LABELS,
  SOURCE_LABELS,
  AGENT_TASK_STATUS_LABELS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

const PILL_BASE =
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-tight whitespace-nowrap leading-none h-5";

const STATUS_CLASSES: Record<BacklogStatus, string> = {
  DETECTED: "bg-muted text-muted-foreground",
  ACCEPTED: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  ASSIGNED_TO_AGENT: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  IMPLEMENTED_CLAIMED: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  IMPLEMENTED_SUSPECTED: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  NEEDS_MANUAL_TEST: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  VERIFIED_DONE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  DISCARDED: "bg-muted text-muted-foreground line-through opacity-80",
  REOPENED: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
};

const TYPE_CLASSES: Record<BacklogType, string> = {
  BUG: "bg-destructive/15 text-destructive",
  FEATURE: "bg-primary/15 text-primary",
  TECH_DEBT: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  VALIDATION_PENDING: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  OPEN_DECISION: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  IMPLEMENTATION_NOT_VERIFIED: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  IDEA: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
};

const SOURCE_CLASSES: Record<BacklogSource, string> = {
  CHATGPT: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  CLAUDE_CODE: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  OPENCODE: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  MANUAL: "bg-muted text-muted-foreground",
  REPO_AUDIT: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  COMMIT_ANALYSIS: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

const TASK_STATUS_CLASSES: Record<AgentTaskStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  READY_TO_SEND: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  SENT: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  RUNNING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  COMPLETED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  FAILED: "bg-destructive/15 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground line-through opacity-80",
};

export function StatusBadge({
  status,
  className,
}: {
  status: BacklogStatus;
  className?: string;
}) {
  return (
    <span className={cn(PILL_BASE, STATUS_CLASSES[status], className)}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function TypeBadge({
  type,
  className,
}: {
  type: BacklogType;
  className?: string;
}) {
  return (
    <span className={cn(PILL_BASE, TYPE_CLASSES[type], className)}>
      {TYPE_LABELS[type] || type}
    </span>
  );
}

export function SourceBadge({
  source,
  className,
}: {
  source: BacklogSource;
  className?: string;
}) {
  return (
    <span className={cn(PILL_BASE, SOURCE_CLASSES[source], className)}>
      {SOURCE_LABELS[source] || source}
    </span>
  );
}

export function TargetRepoBadge({
  target,
  className,
}: {
  target: TargetRepo;
  className?: string;
}) {
  return (
    <span
      className={cn(
        PILL_BASE,
        "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-semibold",
        className
      )}
    >
      {target}
    </span>
  );
}

export function TaskStatusBadge({
  status,
  className,
}: {
  status: AgentTaskStatus;
  className?: string;
}) {
  return (
    <span className={cn(PILL_BASE, TASK_STATUS_CLASSES[status], className)}>
      {AGENT_TASK_STATUS_LABELS[status] || status}
    </span>
  );
}
