import { parseIsoDate, shiftCycleClose, toIsoDate } from "@/lib/dates";

/** Split a total into N parcels, each rounded to centavos; last parcel absorbs remainder. */
export function splitTotalAcrossInstallments(
  totalCents: number,
  installmentCount: number,
): number[] {
  if (installmentCount < 1) {
    throw new Error("installmentCount must be at least 1");
  }
  const per = Math.round(totalCents / installmentCount);
  const amounts = Array.from({ length: installmentCount }, () => per);
  amounts[installmentCount - 1] += totalCents - per * installmentCount;
  return amounts;
}

export function buildInstallments(input: {
  installmentCount: number;
  /** Full purchase total in centavos (preferred for manual entry). */
  totalCents?: number;
  /** Per-installment amount (used by fatura import which already lists parcel values). */
  amountPerInstallmentCents?: number;
  currentNumber: number;
  currentCycleCloseIso: string;
}) {
  const {
    installmentCount,
    currentNumber,
    currentCycleCloseIso,
  } = input;

  let amounts: number[];
  let totalCents: number;

  if (typeof input.totalCents === "number") {
    totalCents = input.totalCents;
    amounts = splitTotalAcrossInstallments(totalCents, installmentCount);
  } else if (typeof input.amountPerInstallmentCents === "number") {
    amounts = Array.from(
      { length: installmentCount },
      () => input.amountPerInstallmentCents!,
    );
    totalCents = input.amountPerInstallmentCents * installmentCount;
  } else {
    throw new Error("totalCents or amountPerInstallmentCents is required");
  }

  const currentClose = parseIsoDate(currentCycleCloseIso);
  const firstClose = shiftCycleClose(currentClose, -(currentNumber - 1));

  const rows = amounts.map((amountCents, index) => {
    const number = index + 1;
    return {
      number,
      ofTotal: installmentCount,
      amountCents,
      cycleCloseDate: toIsoDate(shiftCycleClose(firstClose, index)),
    };
  });

  return { totalCents, installments: rows, firstCycleClose: toIsoDate(firstClose) };
}
