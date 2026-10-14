export function formatBrl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function parseBrlInput(value: string): number {
  const cleaned = value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function centsFromNumber(value: number): number {
  return Math.round(value * 100);
}
