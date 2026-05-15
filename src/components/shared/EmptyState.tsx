import * as React from "react";
import { FadeIn } from "./FadeIn";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Compact variant: smaller padding, smaller icon. */
  compact?: boolean;
}

/**
 * Consistent empty state used across the app.
 * Centered, icon in bg-muted rounded-full p-3, fades in softly.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <FadeIn
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-20 px-6",
        className
      )}
    >
      {icon ? (
        <div
          className={cn(
            "rounded-full bg-muted/70 border border-border/60 flex items-center justify-center mb-4 text-muted-foreground",
            compact ? "size-10" : "size-14"
          )}
        >
          {icon}
        </div>
      ) : null}
      <h3
        className={cn(
          "font-semibold tracking-tight text-foreground",
          compact ? "text-sm" : "text-base"
        )}
      >
        {title}
      </h3>
      {description ? (
        <p
          className={cn(
            "text-muted-foreground mt-1 max-w-md",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </FadeIn>
  );
}
