export type ExtratoParsedRow = {
  occursOn: string;
  description: string;
  amountCents: number;
  method: "pix" | "card_payment" | "transfer" | "other";
};

function parseBrAmount(raw: string): number {
  const negative = raw.trim().startsWith("-");
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const value = Math.round(Math.abs(Number(cleaned)) * 100);
  return negative ? -value : value;
}

function toIso(brDate: string): string {
  const [d, m, y] = brDate.split("/");
  return `${y}-${m}-${d}`;
}

const SKIP =
  /SALDO DO DIA|REND PAGO|saldo em conta|extrato conta|período|emitido em|lançamentos|Aviso!|Os saldos/i;

export function parseItauExtrato(text: string): {
  rows: ExtratoParsedRow[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const rows: ExtratoParsedRow[] = [];
  const lineRe =
    /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})$/;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || SKIP.test(line)) continue;
    const match = line.match(lineRe);
    if (!match) continue;

    const [, dateBr, description, amountRaw] = match;
    const amountCents = parseBrAmount(amountRaw);

    // Never create income from extrato.
    if (amountCents >= 0) continue;

    let method: ExtratoParsedRow["method"] = "other";
    if (/FATURA PAGA/i.test(description)) method = "card_payment";
    else if (/^PIX\b/i.test(description)) method = "pix";
    else if (/RESGATE COFRINHOS|TRANSF/i.test(description)) method = "transfer";

    rows.push({
      occursOn: toIso(dateBr),
      description: description.trim(),
      amountCents: Math.abs(amountCents),
      method,
    });
  }

  if (rows.length === 0) {
    warnings.push("No debit rows parsed from extrato.");
  }

  return { rows, warnings };
}
