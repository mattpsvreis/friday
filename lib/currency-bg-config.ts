/**
 * Tuning knobs for the animated currency background.
 * Edit values here — no need to regenerate the animation code.
 */
export const CURRENCY_BG = {
  /** Near-black canvas clear color. */
  background: "#030705",

  /** Global motion multiplier (1 = default calm drift). */
  speed: 1,

  /** Number of floating note shapes. */
  shapeCount: 26,

  /** Base fill opacity for notes (before depth / route multipliers). */
  shapeOpacity: 0.28,

  /** Mouse parallax strength in CSS pixels at nearest depth. */
  parallaxIntensity: 18,

  /** Soft edge glow strength (0 = none, 1 = default, >1 brighter). */
  glowIntensity: 0.7,

  /** Ghost trail opacity multiplier (0 disables trails). */
  trailOpacity: 0.4,

  /** Soft blur / softness of note fills (shadowBlur + soft strokes). */
  blurSoftness: 0.75,

  /**
   * Normalized radius (0–1 of min(viewport)) kept relatively empty
   * when spawning / wrapping notes toward the edges.
   */
  centerClearRadius: 0.18,

  /** Cap devicePixelRatio for perf (retina still sharp enough). */
  maxDevicePixelRatio: 2,

  /**
   * Route visibility multipliers applied on top of shapeOpacity / glow.
   * Unlock is more visible; the app stays subdued behind glass panels.
   */
  presets: {
    unlock: {
      opacity: 1.4,
      glow: 1.25,
      trail: 1.15,
    },
    app: {
      opacity: 1.05,
      glow: 1,
      trail: 0.85,
    },
  },
} as const;

export type CurrencyBgConfig = typeof CURRENCY_BG;
