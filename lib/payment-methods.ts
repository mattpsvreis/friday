/** DB enum values → UI labels. Keep snake_case keys for storage. */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  credit_card: "Credit Card",
  pix: "PIX",
  transfer: "Transfer",
  other: "Other",
  /** Legacy; not offered in selectors. */
  card_payment: "Card Payment",
};

/** Alphabetical, Other last. No card_payment. */
export const SELECTABLE_PAYMENT_METHODS = [
  "cash",
  "credit_card",
  "pix",
  "transfer",
  "other",
] as const;

/** Income has no credit-card method. Alphabetical, Other last. */
export const SELECTABLE_INCOME_METHODS = [
  "cash",
  "pix",
  "transfer",
  "other",
] as const;

export type SelectablePaymentMethod =
  (typeof SELECTABLE_PAYMENT_METHODS)[number];

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

/** Select options; includes `current` when it is a legacy value not in the list. */
export function paymentMethodSelectOptions(
  methods: readonly string[],
  current?: string,
): string[] {
  if (current && !methods.includes(current)) {
    return [...methods, current];
  }
  return [...methods];
}
