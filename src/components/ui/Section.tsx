import type { HTMLAttributes, ReactNode } from "react";

type SectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  spacing?: "default" | "compact";
  labelledBy?: string;
};

export function Section({
  children,
  spacing = "default",
  labelledBy,
  className = "",
  ...props
}: SectionProps) {
  return (
    <section
      {...props}
      aria-labelledby={labelledBy}
      className={`section ${spacing === "compact" ? "section-compact" : ""} ${className}`.trim()}
    >
      {children}
    </section>
  );
}

