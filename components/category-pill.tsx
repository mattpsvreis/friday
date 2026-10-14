import { contrastingTextColor } from "@/lib/color-contrast";

const FALLBACK_COLOR = "#39ff14";

export function CategoryPill({
  name,
  color,
}: {
  name: string;
  color?: string | null;
}) {
  const bg = color?.trim() || FALLBACK_COLOR;
  const fg = contrastingTextColor(bg);

  return (
    <span
      className="inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide"
      style={{ backgroundColor: bg, color: fg }}
      title={name}
    >
      {name}
    </span>
  );
}
