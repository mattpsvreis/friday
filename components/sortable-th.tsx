"use client";

import { TH_SORT_CLASS } from "@/lib/ui-classes";
import { sortIndicator, type SortDir } from "@/lib/use-table-sort";

export function SortableTh<K extends string>({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  column: K;
  sortKey: K;
  sortDir: SortDir;
  onSort: (key: K) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === column;
  return (
    <th className={`${TH_SORT_CLASS} ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        className={[
          "inline-flex items-center gap-1 uppercase tracking-wide",
          align === "right" ? "ml-auto" : "",
          active ? "text-neon-green" : "",
        ].join(" ")}
        onClick={() => onSort(column)}
      >
        {label}
        <span aria-hidden className="tabular-nums">
          {sortIndicator(active, sortDir)}
        </span>
      </button>
    </th>
  );
}
