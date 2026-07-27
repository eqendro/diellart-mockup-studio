import type { HTMLAttributes, ReactNode } from "react";

type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  size?: "default" | "narrow";
};

export function Container({
  children,
  size = "default",
  className = "",
  ...props
}: ContainerProps) {
  return (
    <div
      {...props}
      className={`container ${size === "narrow" ? "container-narrow" : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

