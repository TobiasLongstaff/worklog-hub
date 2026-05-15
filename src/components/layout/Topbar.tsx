import { AnimatePresence, motion } from "framer-motion";
import { Moon, Plus, RefreshCw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  title: string;
  description: string;
  showActions: boolean;
  theme: "light" | "dark";
  onRefresh: () => void;
  onCreate: () => void;
  onToggleTheme: () => void;
}

export function Topbar({
  title,
  description,
  showActions,
  theme,
  onRefresh,
  onCreate,
  onToggleTheme,
}: TopbarProps) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-6 py-3 border-b border-border/70 bg-card/85 backdrop-blur-md supports-[backdrop-filter]:bg-card/75">
      <motion.div
        key={title}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col min-w-0"
      >
        <h2 className="text-[15px] font-bold tracking-tight truncate text-foreground">
          {title}
        </h2>
        <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{description}</p>
      </motion.div>

      <div className="flex items-center gap-2">
        {showActions && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="h-8 gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
            <Button size="sm" onClick={onCreate} className="h-8 gap-1.5 shadow-sm">
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">Nuevo pendiente</span>
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          className="size-8 shrink-0 relative overflow-hidden"
          aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              initial={{ opacity: 0, rotate: -45, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 45, scale: 0.6 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </motion.span>
          </AnimatePresence>
        </Button>
      </div>
    </div>
  );
}
