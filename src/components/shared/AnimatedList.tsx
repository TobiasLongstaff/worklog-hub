import { motion } from "framer-motion";
import * as React from "react";
import { cn } from "@/lib/utils";

interface AnimatedListProps {
  children: React.ReactNode;
  className?: string;
  staggerMs?: number;
  initialDelayMs?: number;
}

/**
 * Applies stagger entrance to direct children. Each child fades in with y=8 → y=0.
 * Default 40ms between items (TripleD-style cadence — perceptible but never sluggish).
 */
export function AnimatedList({
  children,
  className,
  staggerMs = 40,
  initialDelayMs = 0,
}: AnimatedListProps) {
  return (
    <motion.div
      className={cn("flex flex-col", className)}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 1 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerMs / 1000,
            delayChildren: initialDelayMs / 1000,
          },
        },
      }}
    >
      {React.Children.map(children, (child) => (
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
            },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
