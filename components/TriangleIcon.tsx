export function TriangleIcon({ className = "", direction = "right" }: { className?: string; direction?: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} focusable="false">
      {direction === "left" ? <path d="M16 5.6v12.8L5.8 12 16 5.6Z" fill="currentColor" /> : <path d="M8 5.6v12.8L18.2 12 8 5.6Z" fill="currentColor" />}
    </svg>
  );
}
