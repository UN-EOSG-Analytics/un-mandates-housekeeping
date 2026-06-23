/**
 * Color scales for the co-citation heatmap. White→hue blends with a sqrt
 * transfer (the shared-mandate distribution is heavy-tailed, so a linear scale
 * leaves almost everything pale). No external dependency needed.
 */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Blend white → target by t∈[0,1]. */
function blendFromWhite(target: [number, number, number], t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const c = (v: number) => Math.round(255 + (v - 255) * k);
  return `rgb(${c(target[0])}, ${c(target[1])}, ${c(target[2])})`;
}

/** Pale tint of a hue (white → hue by a small t), for header backgrounds. */
export function tint(hex: string, t = 0.16): string {
  return blendFromWhite(hexToRgb(hex), t);
}

/**
 * Sequential color for a non-negative `value` against `max`, blending white
 * toward `baseHex`. Returns null for zero/empty so the cell stays blank.
 */
export function sequentialColor(
  value: number,
  max: number,
  baseHex: string,
): string | null {
  if (value <= 0 || max <= 0) return null;
  return blendFromWhite(hexToRgb(baseHex), Math.sqrt(value / max));
}

const GREEN: [number, number, number] = [22, 163, 74]; // reduced overlap (better)
const RED: [number, number, number] = [220, 38, 38]; // increased overlap

/**
 * Diverging color for a signed delta. Negative (overlap shrank) → green,
 * positive (overlap grew) → red. Returns null at zero.
 */
export function divergingColor(value: number, maxAbs: number): string | null {
  if (value === 0 || maxAbs <= 0) return null;
  const t = Math.sqrt(Math.min(Math.abs(value) / maxAbs, 1));
  return blendFromWhite(value < 0 ? GREEN : RED, t);
}
