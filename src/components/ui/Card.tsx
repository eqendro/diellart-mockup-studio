import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  interactive?: boolean;
  padding?: "none" | "default";
};

export function Card({
  children,
  interactive = false,
  padding = "default",
  className = "",
  ...props
}: CardProps) {
  return (
    <article
      {...props}
      className={`card ${interactive ? "card-interactive" : ""} ${
        padding === "default" ? "card-padding" : ""
      } ${className}`.trim()}
    >
      {children}
    </article>
  );
}

