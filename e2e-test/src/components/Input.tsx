interface InputProps {
  /** Placeholder text */
  placeholder?: string;
  /** Size preset */
  size?: "sm" | "md" | "lg" | "xl";
  /** Style variant */
  variant?: "Outlined" | "Underlined" | "Rounded";
  /** Disabled state */
  disabled?: boolean;
  /** Error/invalid state */
  error?: boolean;
}

export function Input({
  placeholder = "Placeholder Text",
  size = "md",
  variant = "Outlined",
  disabled = false,
  error = false,
  }: InputProps) {
  return (
    <input
      placeholder={placeholder}
      disabled={disabled}
      aria-invalid={error}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}
