import { ReactNode } from "react";

interface ButtonProps {
  /** Button text or content */
  children: ReactNode;
  /** Visual style */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Size preset */
  size?: "sm" | "md" | "lg";
  /** Disabled state */
  disabled?: boolean;
  /** Loading spinner replaces content */
  loading?: boolean;
  /** Full width of container */
  fullWidth?: boolean;
  /** Leading icon */
  iconLeft?: ReactNode;
  /** Trailing icon */
  iconRight?: ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** HTML button type */
  type?: "button" | "submit" | "reset";
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  fullWidth = false,
  iconLeft,
  iconRight,
  onClick,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      style={{ width: fullWidth ? "100%" : undefined }}
    >
      {loading ? "..." : (
        <>
          {iconLeft}
          {children}
          {iconRight}
        </>
      )}
    </button>
  );
}
