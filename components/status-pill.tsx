"use client";

export function StatusPill({
  enabled,
  onToggle,
  busy,
}: {
  enabled: boolean;
  onToggle?: () => void;
  busy?: boolean;
}) {
  const className = [
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase",
    enabled
      ? "bg-neon-green text-black"
      : "bg-red-600 text-white line-through",
    onToggle ? "cursor-pointer transition-opacity hover:opacity-90" : "",
    busy ? "opacity-50" : "",
  ].join(" ");

  if (!onToggle) {
    return <span className={className}>{enabled ? "ON" : "OFF"}</span>;
  }

  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={onToggle}
      aria-pressed={enabled}
    >
      {enabled ? "ON" : "OFF"}
    </button>
  );
}
