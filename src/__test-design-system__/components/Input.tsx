import { ReactNode } from "react";

interface InputProps {
  /** Input label */
  label: string;
  /** Placeholder text */
  placeholder?: string;
  /** Current value */
  value?: string;
  /** Input type */
  inputType?: "text" | "email" | "password" | "number" | "search" | "tel" | "url";
  /** Size preset */
  size?: "sm" | "md" | "lg";
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readOnly?: boolean;
  /** Error state */
  error?: boolean;
  /** Error message */
  errorMessage?: string;
  /** Helper text below input */
  hint?: string;
  /** Leading icon or element */
  prefix?: ReactNode;
  /** Trailing icon or element */
  suffix?: ReactNode;
  /** Required field indicator */
  required?: boolean;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Blur handler */
  onBlur?: () => void;
}

export function Input({
  label,
  placeholder,
  value,
  inputType = "text",
  size = "md",
  disabled = false,
  readOnly = false,
  error = false,
  errorMessage,
  hint,
  prefix,
  suffix,
  required = false,
  onChange,
  onBlur,
}: InputProps) {
  return (
    <div>
      <label>
        {label}
        {required && <span aria-hidden="true">*</span>}
      </label>
      <div>
        {prefix}
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
        />
        {suffix}
      </div>
      {error && errorMessage && <p role="alert">{errorMessage}</p>}
      {!error && hint && <p>{hint}</p>}
    </div>
  );
}
