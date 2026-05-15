import { motion, type HTMLMotionProps } from "framer-motion";
import * as React from "react";

interface FadeInProps extends Omit<HTMLMotionProps<"div">, "initial" | "animate" | "transition"> {
  delay?: number;
  y?: number;
  duration?: number;
}

/**
 * Soft entrance wrapper. opacity 0→1, y=12→0, duration 0.3s by default.
 * Accepts an optional `delay` so callers can compose staggered reveals.
 */
export const FadeIn = React.forwardRef<HTMLDivElement, FadeInProps>(function FadeIn(
  { delay = 0, y = 12, duration = 0.3, children, ...rest },
  ref
) {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, ease: [0.22, 1, 0.36, 1], delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
});
