export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function clampDay(year: number, monthIndex: number, day: number): number {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(day, last);
}

export function dateWithDay(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, clampDay(year, monthIndex, day)));
}

/** Full calendar month window (1st through last day), UTC. `monthIndex` is 0–11. */
export function calendarMonthWindow(
  year: number,
  monthIndex: number,
): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  return { start, end };
}

export function shiftYearMonth(
  year: number,
  monthIndex: number,
  deltaMonths: number,
): { year: number; monthIndex: number } {
  const d = new Date(Date.UTC(year, monthIndex + deltaMonths, 1));
  return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() };
}

export function cycleCloseDateFor(
  purchaseOrRef: Date,
  cycleCloseDay: number,
): Date {
  const y = purchaseOrRef.getUTCFullYear();
  const m = purchaseOrRef.getUTCMonth();
  const day = purchaseOrRef.getUTCDate();
  if (day <= cycleCloseDay) {
    return dateWithDay(y, m, cycleCloseDay);
  }
  return dateWithDay(y, m + 1, cycleCloseDay);
}

/** Close date of the currently open fatura cycle as of `asOf`. */
export function openCycleCloseDate(asOf: Date, cycleCloseDay: number): Date {
  const y = asOf.getUTCFullYear();
  const m = asOf.getUTCMonth();
  const d = asOf.getUTCDate();
  if (d <= cycleCloseDay) {
    return dateWithDay(y, m, cycleCloseDay);
  }
  return dateWithDay(y, m + 1, cycleCloseDay);
}

export function shiftCycleClose(close: Date, deltaMonths: number): Date {
  const day = close.getUTCDate();
  return dateWithDay(
    close.getUTCFullYear(),
    close.getUTCMonth() + deltaMonths,
    day,
  );
}

export function paymentDueForCycle(
  cycleClose: Date,
  paymentDueDay: number,
): Date {
  // Due is usually after close in the same or next calendar month.
  const closeDay = cycleClose.getUTCDate();
  if (paymentDueDay >= closeDay) {
    return dateWithDay(
      cycleClose.getUTCFullYear(),
      cycleClose.getUTCMonth(),
      paymentDueDay,
    );
  }
  return dateWithDay(
    cycleClose.getUTCFullYear(),
    cycleClose.getUTCMonth() + 1,
    paymentDueDay,
  );
}

/**
 * Month where a fatura cycle counts as an expense for paycheck planning.
 * Cycles cut on the card's close day (e.g. the 4th); that bill is budgeted in
 * the prior calendar month (close Nov 4 → October expense math).
 *
 * Example: purchase on Oct 2 → parcel 1 closes Oct 4 (September budget);
 * viewing October shows parcel 2 (closes Nov 4).
 */
export function faturaExpenseAttributionDate(cycleClose: Date): Date {
  return dateWithDay(
    cycleClose.getUTCFullYear(),
    cycleClose.getUTCMonth() - 1,
    cycleClose.getUTCDate(),
  );
}

export function inInclusiveRange(date: Date, start: Date, end: Date): boolean {
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}
