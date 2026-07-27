import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "small" | "medium" | "large";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary: "button-primary",
  secondary: "button-secondary",
  ghost: "button-ghost",
};

const sizes: Record<ButtonSize, string> = {
  small: "button-small",
  medium: "button-medium",
  large: "button-large",
};

export function Button({
  children,
  variant = "primary",
  size = "medium",
  loading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`button ${variants[variant]} ${sizes[size]} ${className}`.trim()}
    >
      {loading ? (
        <>
          <span className="button-spinner" aria-hidden="true" />
          <span>Loading</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

