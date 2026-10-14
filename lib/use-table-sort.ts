"use client";

import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export function useTableSort<T, K extends string>(
  rows: T[],
  defaultKey: NoInfer<K>,
  compare: (a: T, b: T, key: K, dir: SortDir) => number,
  defaultDir: SortDir = "asc",
) {
  const [sortKey, setSortKey] = useState<K>(defaultKey as K);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  function toggle(key: K) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  const sorted = useMemo(
    () => [...rows].sort((a, b) => compare(a, b, sortKey, sortDir)),
    [rows, sortKey, sortDir, compare],
  );

  return { sorted, sortKey, sortDir, toggle };
}

export function cmpText(a: string, b: string, dir: SortDir) {
  const result = a.localeCompare(b, undefined, { sensitivity: "base" });
  return dir === "asc" ? result : -result;
}

export function cmpNumber(a: number, b: number, dir: SortDir) {
  return dir === "asc" ? a - b : b - a;
}

export function sortIndicator(active: boolean, dir: SortDir) {
  if (!active) return "";
  return dir === "asc" ? " ↑" : " ↓";
}
