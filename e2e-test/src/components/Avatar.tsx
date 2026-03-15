interface AvatarProps {
  /** Size preset */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  /** Display variant */
  variant?: "Text" | "Image";
    badge?: "false" | "true";
}

export function Avatar({
  size = "md",
  variant = "Image", badge = "true" }: AvatarProps) {
  return (
    <div>
      {variant === "Image" && src ? (
        <img src={src} alt={alt} />
      ) : (
        <span>{alt?.slice(0, 2).toUpperCase()}</span>
      )}
      {badge && <span />}
    </div>
  );
}
