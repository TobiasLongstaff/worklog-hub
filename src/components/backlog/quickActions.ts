import type { BacklogItem, BacklogStatus, QuickAction } from "@/lib/types";

export function getQuickActions(item: BacklogItem): QuickAction[] {
  const s = item.status;
  const actions: QuickAction[] = [];
  if (s === "DETECTED") {
    actions.push({ action: "accept", label: "Aceptar", variant: "success" });
    actions.push({ action: "discard", label: "Descartar", variant: "danger" });
  }
  if (s === "ACCEPTED") {
    actions.push({ action: "needs-test", label: "Necesita prueba", variant: "warning" });
    actions.push({ action: "discard", label: "Descartar", variant: "danger" });
  }
  if (
    s === "NEEDS_MANUAL_TEST" ||
    s === "IMPLEMENTED_CLAIMED" ||
    s === "IMPLEMENTED_SUSPECTED"
  ) {
    actions.push({ action: "verify", label: "Verificado", variant: "success" });
    actions.push({ action: "reopen", label: "Reabrir", variant: "ghost" });
  }
  if (s === "VERIFIED_DONE" || s === "DISCARDED") {
    actions.push({ action: "reopen", label: "Reabrir", variant: "ghost" });
  }
  if (s === "REOPENED") {
    actions.push({ action: "accept", label: "Aceptar", variant: "success" });
    actions.push({ action: "discard", label: "Descartar", variant: "danger" });
  }
  return actions;
}

export const ACTION_STATUS_MAP: Record<QuickAction["action"], BacklogStatus> = {
  accept: "ACCEPTED",
  discard: "DISCARDED",
  verify: "VERIFIED_DONE",
  reopen: "REOPENED",
  "needs-test": "NEEDS_MANUAL_TEST",
};
