import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type IndicatorStatus =
  | "active"
  | "stopped"
  | "starting"
  | "error"
  | "unconfigured"
  | "running"
  | "success";

interface StatusIndicatorProps {
  status: IndicatorStatus;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

const COLOR_BY_STATUS: Record<IndicatorStatus, string> = {
  active: "bg-emerald-500",
  success: "bg-emerald-500",
  starting: "bg-amber-500",
  running: "bg-amber-500",
  error: "bg-rose-500",
  stopped: "bg-zinc-400 dark:bg-zinc-500",
  unconfigured: "bg-zinc-300 dark:bg-zinc-600",
};

const LABEL_COLOR: Record<IndicatorStatus, string> = {
  active: "text-emerald-600 dark:text-emerald-400",
  success: "text-emerald-600 dark:text-emerald-400",
  starting: "text-amber-600 dark:text-amber-400",
  running: "text-amber-600 dark:text-amber-400",
  error: "text-rose-600 dark:text-rose-400",
  stopped: "text-muted-foreground",
  unconfigured: "text-muted-foreground",
};

/**
 * Animated status dot. Active/success → slow pulse; starting/running → fast pulse;
 * error/stopped/unconfigured → static.
 */
export function StatusIndicator({
  status,
  label,
  className,
  size = "sm",
}: StatusIndicatorProps) {
  const dotSize = size === "sm" ? "size-2" : "size-2.5";
  const pulse =
    status === "active" || status === "success"
      ? { duration: 2.4, scale: [1, 1.6, 1] as number[] }
      : status === "starting" || status === "running"
      ? { duration: 1.0, scale: [1, 1.8, 1] as number[] }
      : null;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="relative inline-flex">
        <span className={cn("inline-block rounded-full", dotSize, COLOR_BY_STATUS[status])} />
        {pulse ? (
          <motion.span
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-full opacity-50",
              COLOR_BY_STATUS[status]
            )}
            animate={{ scale: pulse.scale, opacity: [0.5, 0, 0.5] }}
            transition={{ duration: pulse.duration, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
      </span>
      {label ? (
        <span className={cn("text-sm font-medium", LABEL_COLOR[status])}>{label}</span>
      ) : null}
    </span>
  );
}
