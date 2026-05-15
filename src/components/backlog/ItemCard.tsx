import { motion } from "framer-motion";
import { cn, fmtDateShort } from "@/lib/utils";
import { AREA_LABELS } from "@/lib/constants";
import type { BacklogItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { StatusBadge, TypeBadge, SourceBadge } from "./StatusBadges";
import { getQuickActions } from "./quickActions";
import { ArrowRight, FolderKanban } from "lucide-react";

interface ItemCardProps {
  item: BacklogItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onQuickAction: (action: string, id: string) => void;
}

const VARIANT_FOR_ACTION: Record<
  string,
  "default" | "outline" | "destructive" | "ghost"
> = {
  accept: "default",
  discard: "outline",
  verify: "default",
  reopen: "ghost",
  "needs-test": "outline",
};

export function ItemCard({ item, selected, onSelect, onQuickAction }: ItemCardProps) {
  const actions = getQuickActions(item);
  const hasMeta = !!item.module || (!!item.area && item.area !== "UNKNOWN");

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.003 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      onClick={() => onSelect(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(item.id);
        }
      }}
      className={cn(
        "group w-full h-full text-left rounded-xl border bg-card p-5 cursor-pointer",
        "flex flex-col gap-0 transition-colors",
        "shadow-[0_1px_3px_0_rgb(0_0_0_/_0.04)]",
        "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        selected
          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20 shadow-sm"
          : "border-border/70 hover:border-border"
      )}
    >
      {/* Row 1: badges + date */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <StatusBadge status={item.status} />
          <TypeBadge type={item.type} />
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0 font-medium tabular-nums mt-0.5">
          {fmtDateShort(item.createdAt)}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-foreground mb-2">
        {item.title}
      </h3>

      {/* Description */}
      {item.description ? (
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-2.5">
          {item.description}
        </p>
      ) : null}

      {/* Next step */}
      {item.suggestedNextStep ? (
        <div className="flex items-start gap-1.5 text-[12px] text-foreground/85 mt-1.5 mb-1 rounded-lg bg-accent/30 px-2.5 py-2 border border-border/40">
          <ArrowRight className="size-3.5 shrink-0 mt-0.5 text-primary" />
          <span className="line-clamp-2 leading-snug">{item.suggestedNextStep}</span>
        </div>
      ) : null}

      {/* Spacer para empujar el footer hacia abajo */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 mt-3.5 pt-3 border-t border-border/50">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <SourceBadge source={item.source} />
          {hasMeta ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <FolderKanban className="size-3" />
              {item.module ? (
                <span className="truncate max-w-[100px]">{item.module}</span>
              ) : null}
              {item.module && item.area && item.area !== "UNKNOWN" ? (
                <span className="opacity-40">·</span>
              ) : null}
              {item.area && item.area !== "UNKNOWN" ? (
                <span>{AREA_LABELS[item.area] || item.area}</span>
              ) : null}
            </span>
          ) : null}
        </div>
        {actions.length > 0 ? (
          <div
            className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {actions.map((a) => (
              <Button
                key={a.action}
                size="sm"
                variant={VARIANT_FOR_ACTION[a.action] ?? "outline"}
                className="h-7 px-2.5 text-[11px]"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickAction(a.action, item.id);
                }}
              >
                {a.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
