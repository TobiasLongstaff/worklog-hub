import * as React from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: number | string;
  description?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function MetricCard({
  label,
  value,
  description,
  icon,
  trend,
  active = false,
  onClick,
  className,
}: MetricCardProps) {
  const Tag = onClick ? motion.button : motion.div;

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.015, y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.985 } : undefined}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      className={cn(
        "group relative w-full flex flex-col justify-between rounded-xl border bg-card px-4 py-4 text-left transition-colors",
        "shadow-[0_1px_2px_0_rgb(0_0_0_/_0.02)]",
        onClick &&
          "cursor-pointer hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        active
          ? "border-primary/60 bg-primary/5 shadow-sm"
          : "border-border/70",
        className
      )}
    >
      {/* Header: label + icon */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="text-[11px] uppercase tracking-[0.1em] font-semibold text-muted-foreground leading-tight">
          {label}
        </div>
        {icon ? (
          <span
            className={cn(
              "shrink-0 size-7 rounded-lg flex items-center justify-center border transition-colors",
              active
                ? "bg-primary/15 text-primary border-primary/20"
                : "bg-muted/60 text-muted-foreground border-transparent group-hover:bg-muted"
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>

      {/* Value */}
      <div className="flex items-end justify-between gap-2">
        <div
          className={cn(
            "text-3xl font-bold tracking-tight leading-none tabular-nums",
            active ? "text-primary" : "text-foreground"
          )}
        >
          {value}
        </div>
        {trend ? <TrendChip trend={trend} /> : null}
      </div>

      {/* Description */}
      {description ? (
        <div className="text-[11px] text-muted-foreground leading-tight mt-2">
          {description}
        </div>
      ) : null}
    </Tag>
  );
}

function TrendChip({ trend }: { trend: "up" | "down" | "neutral" }) {
  const styles =
    trend === "up"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : trend === "down"
      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
      : "bg-muted text-muted-foreground";
  const Icon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        styles
      )}
    >
      <Icon className="size-3" />
    </span>
  );
}
