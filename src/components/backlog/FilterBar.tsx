import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FadeIn } from "@/components/shared/FadeIn";
import { Search, SlidersHorizontal } from "lucide-react";

interface FilterBarProps {
  search: string;
  type: string;
  source: string;
  area: string;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onAreaChange: (value: string) => void;
}

const ALL = "__all__";

export function FilterBar({
  search,
  type,
  source,
  area,
  onSearchChange,
  onTypeChange,
  onSourceChange,
  onAreaChange,
}: FilterBarProps) {
  return (
    <FadeIn className="border-b bg-muted/30">
      <div className="flex flex-wrap items-center gap-3 px-6 py-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Buscar por título, descripción, módulo…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 bg-card border-border/70 focus-visible:border-primary/50 focus-visible:bg-card text-sm"
          />
        </div>

        <div className="hidden md:block h-6 w-px bg-border/70" aria-hidden />

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
          <SlidersHorizontal className="size-3.5" />
          <span>Filtros</span>
        </div>

        <Select
          value={type === "" ? ALL : type}
          onValueChange={(v) => onTypeChange(v === ALL ? "" : v)}
        >
          <SelectTrigger className="w-[170px] h-9 text-xs bg-card border-border/70 hover:bg-accent/40 transition-colors">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los tipos</SelectItem>
            <SelectItem value="BUG">Bug</SelectItem>
            <SelectItem value="TECH_DEBT">Deuda técnica</SelectItem>
            <SelectItem value="FEATURE">Feature</SelectItem>
            <SelectItem value="VALIDATION_PENDING">Validación pendiente</SelectItem>
            <SelectItem value="OPEN_DECISION">Decisión abierta</SelectItem>
            <SelectItem value="IMPLEMENTATION_NOT_VERIFIED">Impl. sin verificar</SelectItem>
            <SelectItem value="IDEA">Idea</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={source === "" ? ALL : source}
          onValueChange={(v) => onSourceChange(v === ALL ? "" : v)}
        >
          <SelectTrigger className="w-[170px] h-9 text-xs bg-card border-border/70 hover:bg-accent/40 transition-colors">
            <SelectValue placeholder="Todos los orígenes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los orígenes</SelectItem>
            <SelectItem value="CHATGPT">ChatGPT</SelectItem>
            <SelectItem value="CLAUDE_CODE">Claude Code</SelectItem>
            <SelectItem value="OPENCODE">OpenCode</SelectItem>
            <SelectItem value="MANUAL">Manual</SelectItem>
            <SelectItem value="REPO_AUDIT">Auditoría repo</SelectItem>
            <SelectItem value="COMMIT_ANALYSIS">Análisis commit</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={area === "" ? ALL : area}
          onValueChange={(v) => onAreaChange(v === ALL ? "" : v)}
        >
          <SelectTrigger className="w-[150px] h-9 text-xs bg-card border-border/70 hover:bg-accent/40 transition-colors">
            <SelectValue placeholder="Todas las áreas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las áreas</SelectItem>
            <SelectItem value="FRONTEND">Frontend</SelectItem>
            <SelectItem value="BACKEND">Backend</SelectItem>
            <SelectItem value="FULLSTACK">Fullstack</SelectItem>
            <SelectItem value="PRODUCT">Producto</SelectItem>
            <SelectItem value="UX">UX</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </FadeIn>
  );
}
