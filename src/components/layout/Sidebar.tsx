import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { BacklogStats, TabKey } from "@/lib/types";
import { Activity } from "lucide-react";

interface SidebarProps {
  activeTab: TabKey;
  stats: BacklogStats | null;
  onSelectTab: (tab: TabKey) => void;
}

interface NavEntry {
  key: TabKey;
  label: string;
  count?: number;
}

interface NavSection {
  title: string;
  items: NavEntry[];
}

export function Sidebar({ activeTab, stats, onSelectTab }: SidebarProps) {
  const sections: NavSection[] = [
    {
      title: "Bandeja",
      items: [
        { key: "DETECTED", label: "Inbox", count: stats?.detected },
        { key: "ACCEPTED", label: "Aceptados", count: stats?.accepted },
        { key: "ASSIGNED_TO_AGENT", label: "En agentes", count: stats?.assignedToAgent },
        {
          key: "SUSPECTED",
          label: "Posib. resueltos",
          count: stats ? stats.implementedClaimed + stats.implementedSuspected : undefined,
        },
        { key: "NEEDS_MANUAL_TEST", label: "Falta probar", count: stats?.needsManualTest },
      ],
    },
    {
      title: "Cerrados",
      items: [
        { key: "VERIFIED_DONE", label: "Verificados", count: stats?.verifiedDone },
        { key: "DISCARDED", label: "Descartados", count: stats?.discarded },
        { key: "REOPENED", label: "Reabiertos", count: stats?.reopened },
      ],
    },
    {
      title: "Vista",
      items: [{ key: "ALL", label: "Todos", count: stats?.total }],
    },
    {
      title: "Integraciones",
      items: [{ key: "CHATGPT_MCP", label: "ChatGPT / MCP" }],
    },
    {
      title: "Resúmenes",
      items: [{ key: "DAILY_SUMMARY", label: "Resumen del día" }],
    },
  ];

  return (
    <aside className="w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground flex flex-col overflow-hidden">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-sidebar-border/70">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-primary/12 border border-primary/20 flex items-center justify-center shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]">
            <Activity className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[14px] font-bold tracking-tight text-foreground leading-tight">
              worklog-hub
            </h1>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-0.5 font-medium">
              Backlog Vivo
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-4 space-y-5">
        {sections.map((sec) => (
          <div key={sec.title}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 px-2.5 mb-1.5">
              {sec.title}
            </div>
            <div className="flex flex-col gap-0.5">
              {sec.items.map((it) => {
                const isActive = it.key === activeTab;
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => onSelectTab(it.key)}
                    className={cn(
                      "relative group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors text-left cursor-pointer",
                      isActive
                        ? "text-sidebar-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    {isActive ? (
                      <motion.span
                        layoutId="sidebar-active-pill"
                        className="absolute inset-0 rounded-lg bg-sidebar-accent border border-sidebar-border/60 shadow-[0_1px_2px_rgb(0_0_0_/_0.04)]"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    ) : null}
                    <span className="relative flex-1 truncate">{it.label}</span>
                    {it.count !== undefined ? (
                      <span
                        className={cn(
                          "relative min-w-[20px] rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-center tabular-nums",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/80 text-muted-foreground group-hover:bg-muted"
                        )}
                      >
                        {it.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border/70 px-4 py-3 flex items-center justify-between">
        <div className="text-[10px] text-muted-foreground font-medium">
          v1.0.0
        </div>
        <div className="text-[10px] text-muted-foreground/80 uppercase tracking-wider">
          CLI · Web
        </div>
      </div>
    </aside>
  );
}
