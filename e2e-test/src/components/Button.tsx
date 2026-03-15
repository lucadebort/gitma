import { ReactNode } from "react";

interface ButtonProps {
  /** Visual action */
  action?: "primary" | "secondary" | "positive" | "negative";
  /** Size preset */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Style variant */
  variant?: "Solid" | "Outlined" | "Linked";
  /** Disabled state */
  disabled?: boolean;
  /** Focused state */
  focused?: boolean;
  /** Show left icon */
  leftIcon?: boolean;
  /** Show right icon */
  rightIcon?: boolean;
}

export function Button({
  action = "primary",
  size = "md",
  variant = "Solid",
  disabled = false,
  focused = false,
  leftIcon = false,
  rightIcon = false,
  }: ButtonProps) {
  return (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
