export type FaturaParsedPurchase = {
  merchant: string;
  purchaseDate: string;
  amountPerInstallmentCents: number;
  installmentCount: number;
  currentNumber: number;
};

export type FaturaParseResult = {
  cycleCloseDate: string | null;
  paymentDueDate: string | null;
  limitCents: number | null;
  purchases: FaturaParsedPurchase[];
  warnings: string[];
};

function parseBrAmount(raw: string): number {
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return Math.round(Math.abs(Number(cleaned)) * 100);
}

function brToIso(d: string, m: string, y: string): string {
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Heuristic Itaú fatura parser — lossy by design. */
export function parseItauFatura(
  text: string,
  fallbackYear: number,
): FaturaParseResult {
  const warnings: string[] = ["Fatura PDF text is noisy; review all imported rows."];
  let cycleCloseDate: string | null = null;
  let paymentDueDate: string | null = null;
  let limitCents: number | null = null;

  const closeMatch = text.match(
    /(?:Postagem|Emiss[aã]o|fechamento)[^\d]{0,40}(\d{2})\/(\d{2})\/(\d{4})/i,
  );
  if (closeMatch) {
    cycleCloseDate = brToIso(closeMatch[1], closeMatch[2], closeMatch[3]);
  }

  const dueMatch = text.match(
    /Vencimento[^\d]{0,40}(\d{2})\/(\d{2})\/(\d{4})/i,
  );
  if (dueMatch) {
    paymentDueDate = brToIso(dueMatch[1], dueMatch[2], dueMatch[3]);
  }

  const limitMatch = text.match(
    /Limite\s*total[^\d]{0,40}([\d.]+,\d{2})/i,
  );
  if (limitMatch) {
    limitCents = parseBrAmount(limitMatch[1]);
  }

  const year =
    cycleCloseDate?.slice(0, 4) ??
    paymentDueDate?.slice(0, 4) ??
    String(fallbackYear);

  const purchases: FaturaParsedPurchase[] = [];
  const seen = new Set<string>();

  // Example shapes: "09/08 MERCHANT 88,00" or "09/01 LISTO *ESCUDE 08/12 239,85"
  const lineRe =
    /(\d{2})\s*\/\s*(\d{2})\s+([A-Za-z0-9*.,\-\s]{3,}?)\s+(\d{2})\s*\/\s*(\d{2})\s+([\d.]+,\d{2})|(\d{2})\s*\/\s*(\d{2})\s+([A-Za-z0-9*.,\-\s]{3,}?)\s+([\d.]+,\d{2})/g;

  let match: RegExpExecArray | null;
  while ((match = lineRe.exec(text)) !== null) {
    let day: string;
    let month: string;
    let merchant: string;
    let amountRaw: string;
    let currentNumber = 1;
    let installmentCount = 1;

    if (match[1] && match[4] && match[5] && match[6]) {
      day = match[1];
      month = match[2];
      merchant = normalizeSpaces(match[3]);
      currentNumber = Number(match[4]);
      installmentCount = Number(match[5]);
      amountRaw = match[6];
    } else {
      day = match[7];
      month = match[8];
      merchant = normalizeSpaces(match[9]);
      amountRaw = match[10];
      const parc = merchant.match(/(\d{2})\s*\/\s*(\d{2})\s*$/);
      if (parc) {
        currentNumber = Number(parc[1]);
        installmentCount = Number(parc[2]);
        merchant = merchant.replace(/\s*\d{2}\s*\/\s*\d{2}\s*$/, "").trim();
      }
    }

    if (!merchant || /Pagamento|Total|Limite|Juros|IOF|continua/i.test(merchant)) {
      continue;
    }
    if (!Number.isFinite(currentNumber) || !Number.isFinite(installmentCount)) {
      continue;
    }
    if (installmentCount < 1 || installmentCount > 48) continue;
    if (currentNumber < 1 || currentNumber > installmentCount) continue;

    const purchaseDate = brToIso(day, month, year);
    const amountPerInstallmentCents = parseBrAmount(amountRaw);
    if (amountPerInstallmentCents <= 0) continue;

    const key = `${purchaseDate}|${merchant}|${amountPerInstallmentCents}|${currentNumber}/${installmentCount}`;
    if (seen.has(key)) continue;
    seen.add(key);

    purchases.push({
      merchant,
      purchaseDate,
      amountPerInstallmentCents,
      installmentCount,
      currentNumber,
    });
  }

  if (!cycleCloseDate) {
    warnings.push("Could not detect fatura close date.");
  }
  if (purchases.length === 0) {
    warnings.push("No purchase lines parsed from fatura.");
  }

  return {
    cycleCloseDate,
    paymentDueDate,
    limitCents,
    purchases,
    warnings,
  };
}
