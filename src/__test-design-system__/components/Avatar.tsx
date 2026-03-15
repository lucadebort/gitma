import { ReactNode } from "react";

interface AvatarProps {
  /** Image URL */
  src?: string;
  /** Alt text for accessibility */
  alt: string;
  /** Fallback when no image: initials or icon */
  fallback?: ReactNode;
  /** Size preset */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Shape */
  shape?: "circle" | "square";
  /** Status indicator */
  status?: "online" | "offline" | "busy" | "away";
  /** Notification badge count (0 = hidden) */
  badge?: number;
  /** Click handler — makes avatar interactive */
  onClick?: () => void;
}

export function Avatar({
  src,
  alt,
  fallback,
  size = "md",
  shape = "circle",
  status,
  badge,
  onClick,
}: AvatarProps) {
  const sizeMap = { xs: 24, sm: 32, md: 40, lg: 48, xl: 64 };
  const px = sizeMap[size];

  return (
    <div
      role={onClick ? "button" : "img"}
      aria-label={alt}
      onClick={onClick}
      style={{
        width: px,
        height: px,
        borderRadius: shape === "circle" ? "50%" : 8,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {src ? (
        <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
          {fallback ?? alt.slice(0, 2).toUpperCase()}
        </div>
      )}
      {status && (
        <span
          aria-label={status}
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 10,
            height: 10,
            borderRadius: "50%",
          }}
        />
      )}
      {badge !== undefined && badge > 0 && (
        <span style={{ position: "absolute", top: -4, right: -4 }}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </div>
  );
}
