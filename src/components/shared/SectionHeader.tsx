import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Show a subtle separator below the header. */
  separator?: boolean;
}

/**
 * Header for sections inside a detail panel or settings card.
 * - title: text-sm font-semibold tracking-tight
 * - description: text-xs text-muted-foreground
 * - optional bottom separator
 */
export function SectionHeader({
  title,
  description,
  action,
  className,
  separator = false,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3",
        separator && "pb-2 border-b border-border/60",
        className
      )}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
