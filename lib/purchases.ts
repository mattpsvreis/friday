import { parseIsoDate, shiftCycleClose, toIsoDate } from "@/lib/dates";

export function buildInstallments(input: {
  installmentCount: number;
  amountPerInstallmentCents: number;
  currentNumber: number;
  currentCycleCloseIso: string;
}) {
  const {
    installmentCount,
    amountPerInstallmentCents,
    currentNumber,
    currentCycleCloseIso,
  } = input;
  const currentClose = parseIsoDate(currentCycleCloseIso);
  const firstClose = shiftCycleClose(currentClose, -(currentNumber - 1));
  const totalCents = amountPerInstallmentCents * installmentCount;

  const rows = Array.from({ length: installmentCount }, (_, index) => {
    const number = index + 1;
    return {
      number,
      ofTotal: installmentCount,
      amountCents: amountPerInstallmentCents,
      cycleCloseDate: toIsoDate(shiftCycleClose(firstClose, index)),
    };
  });

  return { totalCents, installments: rows, firstCycleClose: toIsoDate(firstClose) };
}
