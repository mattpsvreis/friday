"use client";

import { useEffect, useState } from "react";

/** Today's date as YYYY-MM-DD, set after mount so prerender stays stable. */
export function useTodayIso() {
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  return today;
}
