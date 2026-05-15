import type {
  BacklogStatus,
  BacklogType,
  BacklogSource,
  BacklogArea,
  AgentType,
  AgentTaskStatus,
  TabKey,
} from "./types";

export const TAB_CONFIG: Record<TabKey, { label: string; desc: string }> = {
  DETECTED: {
    label: "Inbox — Detectados",
    desc: "Pendientes detectados que aún no fueron revisados",
  },
  ACCEPTED: { label: "Aceptados", desc: "Pendientes aceptados como trabajo real" },
  ASSIGNED_TO_AGENT: {
    label: "En agentes",
    desc: "Pendientes delegados a Claude Code, OpenCode u otro agente",
  },
  SUSPECTED: {
    label: "Posiblemente resueltos",
    desc: "Implementados o sospechados de estar resueltos — pendiente revisión",
  },
  NEEDS_MANUAL_TEST: {
    label: "Falta probar manualmente",
    desc: "Requieren validación humana antes de cerrar",
  },
  VERIFIED_DONE: {
    label: "Verificados y cerrados",
    desc: "Confirmados como resueltos por revisión humana",
  },
  DISCARDED: { label: "Descartados", desc: "Descartados — no aplican o quedaron obsoletos" },
  REOPENED: { label: "Reabiertos", desc: "Reabiertos tras ser cerrados o descartados" },
  ALL: { label: "Todos los pendientes", desc: "Vista completa del backlog" },
  CHATGPT_MCP: {
    label: "Integración ChatGPT / MCP",
    desc: "Servidor MCP local y túnel ngrok para conectar con ChatGPT",
  },
};

export const TAB_STATUS_MAP: Record<TabKey, BacklogStatus[]> = {
  DETECTED: ["DETECTED"],
  ACCEPTED: ["ACCEPTED"],
  ASSIGNED_TO_AGENT: ["ASSIGNED_TO_AGENT"],
  SUSPECTED: ["IMPLEMENTED_CLAIMED", "IMPLEMENTED_SUSPECTED"],
  NEEDS_MANUAL_TEST: ["NEEDS_MANUAL_TEST"],
  VERIFIED_DONE: ["VERIFIED_DONE"],
  DISCARDED: ["DISCARDED"],
  REOPENED: ["REOPENED"],
  ALL: [],
  CHATGPT_MCP: [],
};

export const TYPE_LABELS: Record<BacklogType, string> = {
  BUG: "Bug",
  TECH_DEBT: "Deuda técnica",
  FEATURE: "Feature",
  VALIDATION_PENDING: "Validación pendiente",
  OPEN_DECISION: "Decisión abierta",
  IMPLEMENTATION_NOT_VERIFIED: "Impl. sin verificar",
  IDEA: "Idea",
};

export const STATUS_LABELS: Record<BacklogStatus, string> = {
  DETECTED: "Detectado",
  ACCEPTED: "Aceptado",
  ASSIGNED_TO_AGENT: "En agente",
  IMPLEMENTED_CLAIMED: "Impl. reclamado",
  IMPLEMENTED_SUSPECTED: "Impl. sospechado",
  NEEDS_MANUAL_TEST: "Falta probar",
  VERIFIED_DONE: "Verificado",
  DISCARDED: "Descartado",
  REOPENED: "Reabierto",
};

export const SOURCE_LABELS: Record<BacklogSource, string> = {
  CHATGPT: "ChatGPT",
  CLAUDE_CODE: "Claude Code",
  OPENCODE: "OpenCode",
  MANUAL: "Manual",
  REPO_AUDIT: "Auditoría",
  COMMIT_ANALYSIS: "Commit",
};

export const AREA_LABELS: Record<BacklogArea, string> = {
  FRONTEND: "Frontend",
  BACKEND: "Backend",
  FULLSTACK: "Fullstack",
  PRODUCT: "Producto",
  UX: "UX",
  UNKNOWN: "—",
};

export const AGENT_LABELS: Record<AgentType, string> = {
  CLAUDE_CODE: "Claude Code",
  OPENCODE: "OpenCode",
};

export const AGENT_TASK_STATUS_LABELS: Record<AgentTaskStatus, string> = {
  DRAFT: "Borrador",
  READY_TO_SEND: "Listo p/ enviar",
  SENT: "Enviado",
  RUNNING: "Corriendo",
  COMPLETED: "Completado",
  FAILED: "Fallido",
  CANCELLED: "Cancelado",
};

export const EVIDENCE_TYPES = [
  "CHATGPT_CONTEXT",
  "AGENT_LOG",
  "COMMIT",
  "FILE_DIFF",
  "TEST_RESULT",
  "MANUAL_NOTE",
  "REPO_AUDIT",
] as const;

export const TARGET_OPTS = [
  { value: "FRONTEND" as const, label: "Frontend", icon: "FE" },
  { value: "BACKEND" as const, label: "Backend", icon: "BE" },
  { value: "FULLSTACK" as const, label: "Fullstack", icon: "FS" },
];

export const PROMPT_TYPE_OPTS = [
  { value: "IMPLEMENTATION" as const, label: "Implementación" },
  { value: "AUDIT" as const, label: "Auditoría" },
  { value: "INVESTIGATION" as const, label: "Investigación" },
  { value: "STRATEGY" as const, label: "Estrategia" },
];

export const IS_TAURI =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const API_ORIGIN = IS_TAURI ? "http://localhost:3131" : "";
