import * as React from "react";
import { cn } from "@/lib/utils";

// ── Inline parser ─────────────────────────────────────────────────────────────

function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part ? <React.Fragment key={i}>{part}</React.Fragment> : null;
      })}
    </>
  );
}

// ── Block parser ──────────────────────────────────────────────────────────────

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "para"; lines: string[] }
  | { kind: "hr" };

function parseBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let paraLines: string[] = [];
  let listItems: string[] = [];

  function flushPara() {
    const joined = paraLines.join(" ").trim();
    if (joined) blocks.push({ kind: "para", lines: [...paraLines] });
    paraLines = [];
  }

  function flushList() {
    if (listItems.length > 0) {
      blocks.push({ kind: "list", items: [...listItems] });
      listItems = [];
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^# /.test(line)) {
      flushPara();
      flushList();
      blocks.push({ kind: "h1", text: line.slice(2).trim() });
    } else if (/^## /.test(line)) {
      flushPara();
      flushList();
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
    } else if (/^---+$/.test(line.trim())) {
      flushPara();
      flushList();
      blocks.push({ kind: "hr" });
    } else if (/^[-*] /.test(line)) {
      flushPara();
      listItems.push(line.slice(2).trim());
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      paraLines.push(line);
    }
  }

  flushPara();
  flushList();
  return blocks;
}

// ── Section colors ────────────────────────────────────────────────────────────

const SECTION_ACCENT: Record<string, string> = {
  "Avances principales": "border-l-emerald-500 text-emerald-600 dark:text-emerald-400",
  "Trabajo realizado con agentes": "border-l-violet-500 text-violet-600 dark:text-violet-400",
  "Pendientes abiertos": "border-l-amber-500 text-amber-600 dark:text-amber-400",
  "Validaciones o pruebas pendientes": "border-l-orange-500 text-orange-600 dark:text-orange-400",
  "Qué conviene retomar mañana": "border-l-blue-500 text-blue-600 dark:text-blue-400",
  "Estado general del día": "border-l-primary text-primary",
};

function sectionAccent(text: string): string {
  return SECTION_ACCENT[text] ?? "border-l-border text-muted-foreground";
}

// ── Block renderers ───────────────────────────────────────────────────────────

function H1Block({ text }: { text: string }) {
  return (
    <h1 className="text-base font-bold tracking-tight text-foreground leading-tight">
      {text}
    </h1>
  );
}

function H2Block({ text }: { text: string }) {
  const accent = sectionAccent(text);
  const [leftBorder, textColor] = accent.split(" ");
  return (
    <div className={cn("flex items-center gap-2 border-l-[3px] pl-3 py-0.5 mt-1", leftBorder)}>
      <span className={cn("text-[11px] font-bold uppercase tracking-[0.1em]", textColor)}>
        {text}
      </span>
    </div>
  );
}

function ListBlock({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 ml-1">
      {items.map((item, i) => {
        const isSubLabel = /^(OpenCode|Claude Code|Claude|Agentes?)\s*:/i.test(item);
        return (
          <li key={i} className="flex items-start gap-2">
            <span
              className={cn(
                "mt-[5px] size-1.5 rounded-full shrink-0",
                isSubLabel ? "bg-muted-foreground/40" : "bg-primary/60"
              )}
            />
            <span
              className={cn(
                "text-sm leading-relaxed",
                isSubLabel ? "text-muted-foreground" : "text-foreground/85"
              )}
            >
              {parseInline(item)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ParaBlock({ lines }: { lines: string[] }) {
  return (
    <p className="text-sm text-foreground/80 leading-relaxed">
      {parseInline(lines.join(" "))}
    </p>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface MarkdownContentProps {
  content: string;
  /** If set, only render up to this many section (h2) blocks */
  maxSections?: number;
  className?: string;
}

export function MarkdownContent({ content, maxSections, className }: MarkdownContentProps) {
  const blocks = React.useMemo(() => parseBlocks(content), [content]);

  let sectionCount = 0;
  const visible: Block[] = [];

  for (const block of blocks) {
    if (maxSections !== undefined) {
      if (block.kind === "h2") {
        sectionCount++;
        if (sectionCount > maxSections) break;
      }
      if (block.kind === "h1") {
        // skip top-level title if we already show it in the header
        continue;
      }
    }
    visible.push(block);
  }

  return (
    <div className={cn("space-y-3", className)}>
      {visible.map((block, i) => {
        switch (block.kind) {
          case "h1":
            return <H1Block key={i} text={block.text} />;
          case "h2":
            return <H2Block key={i} text={block.text} />;
          case "list":
            return <ListBlock key={i} items={block.items} />;
          case "para":
            return <ParaBlock key={i} lines={block.lines} />;
          case "hr":
            return <hr key={i} className="border-border/40" />;
        }
      })}
    </div>
  );
}
