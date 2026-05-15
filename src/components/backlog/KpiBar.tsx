import type { BacklogStats, TabKey } from "@/lib/types";
import { MetricCard } from "@/components/shared/MetricCard";
import { motion } from "framer-motion";
import {
  Inbox,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  XCircle,
} from "lucide-react";

interface KpiBarProps {
  stats: BacklogStats | null;
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
}

interface KpiDef {
  key: TabKey;
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  description?: string;
}

export function KpiBar({ stats, activeTab, onSelectTab }: KpiBarProps) {
  const items: KpiDef[] = [
    {
      key: "DETECTED",
      label: "Detectados",
      value: stats?.detected,
      icon: <Inbox className="size-3.5" />,
      description: "Sin revisar",
    },
    {
      key: "ACCEPTED",
      label: "Aceptados",
      value: stats?.accepted,
      icon: <ClipboardCheck className="size-3.5" />,
      description: "Listos p/ trabajar",
    },
    {
      key: "NEEDS_MANUAL_TEST",
      label: "Falta probar",
      value: stats?.needsManualTest,
      icon: <CircleDashed className="size-3.5" />,
      description: "Validación humana",
    },
    {
      key: "VERIFIED_DONE",
      label: "Cerrados",
      value: stats?.verifiedDone,
      icon: <CheckCircle2 className="size-3.5" />,
      description: "Verificados",
    },
    {
      key: "DISCARDED",
      label: "Descartados",
      value: stats?.discarded,
      icon: <XCircle className="size-3.5" />,
      description: "No aplican",
    },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 1 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.04, delayChildren: 0.05 },
        },
      }}
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 px-5 py-4 border-b border-border/60 bg-muted/15"
    >
      {items.map((kpi) => (
        <motion.div
          key={kpi.key}
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
            },
          }}
        >
          <MetricCard
            label={kpi.label}
            value={kpi.value !== undefined ? kpi.value : "—"}
            description={kpi.description}
            icon={kpi.icon}
            active={kpi.key === activeTab}
            onClick={() => onSelectTab(kpi.key)}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
