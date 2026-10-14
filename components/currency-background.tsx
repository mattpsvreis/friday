"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { CURRENCY_BG } from "@/lib/currency-bg-config";

const SYMBOLS = ["$", "€", "£", "¥", "R$"] as const;

type Note = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  rot: number;
  rotSpeed: number;
  vx: number;
  vy: number;
  phase: number;
  wobbleAmp: number;
  wobbleFreq: number;
  symbol: (typeof SYMBOLS)[number];
  trail: { x: number; y: number; rot: number }[];
};

type Parallax = { x: number; y: number; tx: number; ty: number };

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pickSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!;
}

/** Push spawn point away from the viewport center. */
function edgeBiasedPosition(
  width: number,
  height: number,
  clearRadius: number,
): { x: number; y: number } {
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);
  const clearPx = clearRadius * minDim;

  for (let i = 0; i < 12; i++) {
    const x = rand(-40, width + 40);
    const y = rand(-40, height + 40);
    const dx = x - cx;
    const dy = y - cy;
    if (Math.hypot(dx, dy) >= clearPx * 0.85) return { x, y };
  }

  // Fallback: place along a random edge ring
  const angle = rand(0, Math.PI * 2);
  const r = clearPx + rand(20, minDim * 0.35);
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

function createNote(width: number, height: number): Note {
  const z = rand(0.25, 1);
  const baseW = rand(72, 140) * (0.55 + z * 0.55);
  const pos = edgeBiasedPosition(width, height, CURRENCY_BG.centerClearRadius);
  const drift = 12 + z * 28;

  return {
    x: pos.x,
    y: pos.y,
    z,
    w: baseW,
    h: baseW * rand(0.48, 0.62),
    rot: rand(-0.35, 0.35),
    rotSpeed: rand(-0.08, 0.08),
    vx: rand(-drift, drift) * 0.35,
    vy: rand(-drift * 0.6, drift * 0.6),
    phase: rand(0, Math.PI * 2),
    wobbleAmp: rand(6, 18) * z,
    wobbleFreq: rand(0.25, 0.7),
    symbol: pickSymbol(),
    trail: [],
  };
}

function wrapNote(note: Note, width: number, height: number) {
  const margin = Math.max(note.w, note.h) * 0.75;
  if (note.x < -margin) note.x = width + margin * 0.5;
  else if (note.x > width + margin) note.x = -margin * 0.5;
  if (note.y < -margin) note.y = height + margin * 0.5;
  else if (note.y > height + margin) note.y = -margin * 0.5;
}

function drawNote(
  ctx: CanvasRenderingContext2D,
  note: Note,
  px: number,
  py: number,
  opacityMul: number,
  glowMul: number,
  alphaScale: number,
) {
  const cfg = CURRENCY_BG;
  const depthAlpha = 0.45 + note.z * 0.55;
  const alpha = cfg.shapeOpacity * depthAlpha * opacityMul * alphaScale;
  if (alpha < 0.01) return;

  const soft = cfg.blurSoftness;
  const glow = cfg.glowIntensity * glowMul * note.z;

  ctx.save();
  ctx.translate(note.x + px * note.z, note.y + py * note.z);
  ctx.rotate(note.rot);
  ctx.globalAlpha = alpha;

  const hw = note.w / 2;
  const hh = note.h / 2;
  const r = Math.min(10, note.h * 0.18);

  // Soft body
  ctx.shadowColor = `rgba(40, 180, 90, ${0.25 * glow * soft})`;
  ctx.shadowBlur = 12 * soft * glow + 4;
  ctx.fillStyle = `rgba(18, 72, 42, ${0.55 + note.z * 0.25})`;
  roundRect(ctx, -hw, -hh, note.w, note.h, r);
  ctx.fill();

  // Inner wash
  ctx.shadowBlur = 0;
  const wash = ctx.createLinearGradient(-hw, -hh, hw, hh);
  wash.addColorStop(0, `rgba(57, 255, 20, ${0.08 * glow})`);
  wash.addColorStop(0.5, "rgba(12, 40, 24, 0.15)");
  wash.addColorStop(1, `rgba(30, 120, 60, ${0.12 * glow})`);
  ctx.fillStyle = wash;
  roundRect(ctx, -hw + 2, -hh + 2, note.w - 4, note.h - 4, r * 0.7);
  ctx.fill();

  // Edge highlight
  ctx.strokeStyle = `rgba(90, 220, 130, ${0.35 + 0.35 * glow})`;
  ctx.lineWidth = 1 + glow * 0.6;
  roundRect(ctx, -hw, -hh, note.w, note.h, r);
  ctx.stroke();

  // Corner filigree dots
  ctx.fillStyle = `rgba(120, 240, 160, ${0.25 + 0.3 * glow})`;
  const inset = 8;
  for (const [dx, dy] of [
    [-hw + inset, -hh + inset],
    [hw - inset, -hh + inset],
    [-hw + inset, hh - inset],
    [hw - inset, hh - inset],
  ] as const) {
    ctx.beginPath();
    ctx.arc(dx, dy, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Currency symbol
  ctx.fillStyle = `rgba(160, 245, 190, ${0.45 + 0.25 * glow})`;
  ctx.font = `${Math.round(note.h * 0.42)}px "Source Serif 4", Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(note.symbol, 0, 1);

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function syncNotes(notes: Note[], count: number, width: number, height: number) {
  while (notes.length < count) notes.push(createNote(width, height));
  if (notes.length > count) notes.length = count;
}

export function CurrencyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();
  const routeRef = useRef<"unlock" | "app">(
    pathname.startsWith("/unlock") ? "unlock" : "app",
  );

  useEffect(() => {
    routeRef.current = pathname.startsWith("/unlock") ? "unlock" : "app";
  }, [pathname]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const notes: Note[] = [];
    const parallax: Parallax = { x: 0, y: 0, tx: 0, ty: 0 };
    let width = 0;
    let height = 0;
    let raf = 0;
    let last = performance.now();
    let running = true;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = media.matches;

    function resize() {
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        CURRENCY_BG.maxDevicePixelRatio,
      );
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.max(1, Math.floor(width * dpr));
      canvas!.height = Math.max(1, Math.floor(height * dpr));
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      syncNotes(notes, CURRENCY_BG.shapeCount, width, height);
    }

    function onPointer(e: PointerEvent) {
      if (reducedMotion) return;
      const nx = (e.clientX / Math.max(width, 1) - 0.5) * 2;
      const ny = (e.clientY / Math.max(height, 1) - 0.5) * 2;
      parallax.tx = nx * CURRENCY_BG.parallaxIntensity;
      parallax.ty = ny * CURRENCY_BG.parallaxIntensity;
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else if (reducedMotion) {
        paintFrame(0, false);
      } else {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    function paintFrame(dt: number, animate: boolean) {
      const cfg = CURRENCY_BG;
      const preset = cfg.presets[routeRef.current];
      const opacityMul = preset.opacity;
      const glowMul = preset.glow;
      const trailMul = preset.trail;

      ctx!.fillStyle = cfg.background;
      ctx!.fillRect(0, 0, width, height);

      // Very faint ambient emerald wash at edges
      const edge = ctx!.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.15,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.75,
      );
      edge.addColorStop(0, "rgba(0,0,0,0)");
      edge.addColorStop(1, "rgba(8, 40, 22, 0.35)");
      ctx!.fillStyle = edge;
      ctx!.fillRect(0, 0, width, height);

      if (animate) {
        const lerp = 1 - Math.exp(-dt * 4);
        parallax.x += (parallax.tx - parallax.x) * lerp;
        parallax.y += (parallax.ty - parallax.y) * lerp;
      }

      for (const note of notes) {
        if (animate) {
          const speed = cfg.speed;
          note.phase += dt * note.wobbleFreq * speed;
          note.x +=
            (note.vx + Math.sin(note.phase) * note.wobbleAmp * 0.15) *
            dt *
            speed;
          note.y +=
            (note.vy + Math.cos(note.phase * 0.85) * note.wobbleAmp * 0.12) *
            dt *
            speed;
          note.rot += note.rotSpeed * dt * speed;
          wrapNote(note, width, height);

          if (cfg.trailOpacity > 0) {
            note.trail.unshift({ x: note.x, y: note.y, rot: note.rot });
            if (note.trail.length > 3) note.trail.length = 3;
          }
        }

        // Trails (ghosts)
        if (cfg.trailOpacity > 0 && note.trail.length > 1) {
          for (let i = note.trail.length - 1; i >= 1; i--) {
            const ghost = note.trail[i]!;
            const ghostNote = { ...note, x: ghost.x, y: ghost.y, rot: ghost.rot };
            drawNote(
              ctx!,
              ghostNote,
              parallax.x,
              parallax.y,
              opacityMul,
              glowMul * 0.4,
              (cfg.trailOpacity * trailMul * (1 - i / note.trail.length)) / 2.2,
            );
          }
        }

        drawNote(
          ctx!,
          note,
          parallax.x,
          parallax.y,
          opacityMul,
          glowMul,
          1,
        );
      }
    }

    function frame(now: number) {
      if (!running) return;
      const rawDt = (now - last) / 1000;
      last = now;
      const dt = Math.min(rawDt, 0.05);

      if (reducedMotion) {
        paintFrame(0, false);
        return;
      }

      paintFrame(dt, true);
      raf = requestAnimationFrame(frame);
    }

    function syncMotion() {
      const next = media.matches;
      if (next === reducedMotion) return;
      reducedMotion = next;
      if (reducedMotion) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        paintFrame(0, false);
      } else if (!document.hidden) {
        last = performance.now();
        running = true;
        raf = requestAnimationFrame(frame);
      }
    }

    resize();
    syncNotes(notes, CURRENCY_BG.shapeCount, width, height);
    paintFrame(0, false);

    if (!reducedMotion && !document.hidden) {
      raf = requestAnimationFrame(frame);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    media.addEventListener("change", syncMotion);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      media.removeEventListener("change", syncMotion);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
