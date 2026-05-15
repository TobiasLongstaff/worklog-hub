import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
  );
}

export function fmtDateShort(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
