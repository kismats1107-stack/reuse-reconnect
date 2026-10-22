import type { ElementType, ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  tone?: "default" | "cost" | "lime";
  /** Brighten the border on hover/focus. */
  interactive?: boolean;
  small?: boolean;
  /** Tiny index printed in the top-right corner, e.g. "01". */
  index?: string;
  as?: ElementType;
};

/** Angular card with a 1px technical border and corner ticks. */
export function CyberCard({
  children,
  className = "",
  tone = "default",
  interactive = false,
  small = false,
  index,
  as: Tag = "div",
}: Props) {
  return (
    <Tag
      data-tone={tone === "default" ? undefined : tone}
      className={`cyber group ${interactive ? "cyber-hover" : ""} ${small ? "cyber-sm" : ""} ${className}`}
    >
      {/* corner ticks on the two square corners */}
      <span aria-hidden="true" className="pointer-events-none absolute right-2 top-2 h-2.5 w-2.5 border-r border-t border-muted/40 transition-colors group-hover:border-cyan" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-2 left-2 h-2.5 w-2.5 border-b border-l border-muted/40 transition-colors group-hover:border-cyan" />
      {index && (
        <span aria-hidden="true" className="pointer-events-none absolute right-6 top-2 font-mono text-[0.65rem] tracking-widest text-faint">
          {index}
        </span>
      )}
      {children}
    </Tag>
  );
}
