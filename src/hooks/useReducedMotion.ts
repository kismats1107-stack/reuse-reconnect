import { useReducedMotion as useMotionReducedMotion } from "motion/react";

/** True when the visitor asked the OS for less motion. */
export function useReducedMotion(): boolean {
  return useMotionReducedMotion() ?? false;
}
