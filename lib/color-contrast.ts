/** WCAG relative luminance for sRGB channels in 0–255. */
function relativeLuminance(r: number, g: number, b: number) {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Pick black or white text for a solid background hex so contrast stays readable
 * (approx. WCAG AA for normal text against #000 / #fff).
 */
export function contrastingTextColor(bgHex: string): "#000000" | "#ffffff" {
  const rgb = parseHexRgb(bgHex);
  if (!rgb) return "#ffffff";
  return relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.179 ? "#000000" : "#ffffff";
}
