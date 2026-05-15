import { Inbox, AlertTriangle } from "lucide-react";
import type { BacklogItem } from "@/lib/types";
import { ItemCard } from "./ItemCard";
import { AnimatedList } from "@/components/shared/AnimatedList";
import { EmptyState } from "@/components/shared/EmptyState";

interface ItemListProps {
  items: BacklogItem[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onQuickAction: (action: string, id: string) => void;
}

export function ItemList({
  items,
  loading,
  error,
  selectedId,
  onSelect,
  onQuickAction,
}: ItemListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <ItemCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle className="size-6 text-destructive" />}
        title="Error cargando datos"
        description={error}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="size-6" />}
        title="Sin pendientes en esta vista"
        description="No hay ítems que coincidan con los filtros actuales. Probá cambiar los filtros o crear un pendiente nuevo desde el botón de arriba."
      />
    );
  }

  return (
    <AnimatedList className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-5" staggerMs={40}>
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          selected={selectedId === item.id}
          onSelect={onSelect}
          onQuickAction={onQuickAction}
        />
      ))}
    </AnimatedList>
  );
}

/**
 * Skeleton that mirrors the actual ItemCard layout instead of a generic block.
 * Helps the page feel less janky during initial loads.
 */
function ItemCardSkeleton() {
  return (
    <div className="w-full rounded-xl border border-border/70 bg-card p-5 animate-pulse flex flex-col gap-0 min-h-[140px]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex gap-1.5">
          <div className="h-5 w-16 rounded-full bg-muted" />
          <div className="h-5 w-14 rounded-full bg-muted" />
        </div>
        <div className="h-3 w-16 rounded bg-muted" />
      </div>
      <div className="h-4 w-4/5 rounded bg-muted mb-2.5" />
      <div className="h-3 w-full rounded bg-muted/70 mb-1.5" />
      <div className="h-3 w-3/4 rounded bg-muted/70 mb-0" />
      <div className="flex-1" />
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/40">
        <div className="h-5 w-20 rounded-full bg-muted" />
        <div className="flex gap-1.5">
          <div className="h-7 w-16 rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}
