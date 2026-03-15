import { ReactNode } from "react";

interface CardProps {
  /** Card body content */
  children: ReactNode;
  /** Optional header area */
  header?: ReactNode;
  /** Optional footer area (actions, links) */
  footer?: ReactNode;
  /** Optional cover image/media above header */
  media?: ReactNode;
  /** Padding preset */
  padding?: "none" | "sm" | "md" | "lg";
  /** Elevation level */
  elevation?: "flat" | "raised" | "floating";
  /** Border style */
  bordered?: boolean;
  /** Click handler — makes the whole card interactive */
  onClick?: () => void;
}

export function Card({
  children,
  header,
  footer,
  media,
  padding = "md",
  elevation = "flat",
  bordered = true,
  onClick,
}: CardProps) {
  const interactive = !!onClick;

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === "Enter") onClick?.(); } : undefined}
    >
      {media}
      {header && <div>{header}</div>}
      <div>{children}</div>
      {footer && <div>{footer}</div>}
    </div>
  );
}
