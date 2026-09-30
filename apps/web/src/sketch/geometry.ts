// Seeded hand-drawn geometry: pure functions returning SVG path data, so a later mobile app can draw the same
// shapes (react-native-svg or Skia). The same seed always gives the same path, so a drawing never jitters between
// renders: per-Task shapes are seeded from the Task's id (seedOf), the page's chrome from the fixed SEEDS below.
import rough from 'roughjs';
import type { Options } from 'roughjs/bin/core';
import { getStroke } from 'perfect-freehand';

const gen = rough.generator();

/** Fixed seeds for the page's chrome, one per shape, so no two pieces of chrome look alike. */
export const SEEDS = {
  previousDate: 11,
  nextDate: 12,
  input: 21,
  add: 22,
  dividers: 31,
} as const;

/** A seed from a stable id (FNV-1a), in rough.js's range 1 … 2^31 − 2. */
export function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2147483646) + 1;
}

/** A seeded random number generator (mulberry32), returning numbers in [0, 1). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SketchPath = { d: string; strokeWidth: number };

/** Every rough.js shape must be seeded, or it would be drawn differently on each render. */
export type SketchOptions = Options & { seed: number };

/** The pencil for sketched boxes: inputs, buttons, checkboxes. */
export const BOX: Options = { roughness: 1.2, bowing: 1, strokeWidth: 1.5 };

/** The pencil for icons: mini-Matrix, mini-list, gear. */
export const ICON: Options = { roughness: 0.8, bowing: 0.5, strokeWidth: 1.4 };

const paths = (drawable: ReturnType<typeof gen.rectangle>): SketchPath[] =>
  gen
    .toPaths(drawable)
    .filter((p) => p.stroke !== 'none')
    .map((p) => ({ d: p.d, strokeWidth: p.strokeWidth }));

export const roughRect = (x: number, y: number, w: number, h: number, o: SketchOptions) => paths(gen.rectangle(x, y, w, h, o));

const roughLine = (x1: number, y1: number, x2: number, y2: number, o: SketchOptions) => paths(gen.line(x1, y1, x2, y2, o));

/**
 * A mini-Matrix, `size` px square: a box split into four Quadrants, with the one at `marked` (its index in
 * QUADRANTS: left to right, top to bottom) hatched in, if given.
 */
export function miniMatrix(size: number, seed: number, marked?: number): SketchPath[] {
  const inset = 1.5;
  const side = size - 2 * inset;
  const half = side / 2;
  const mid = inset + half;
  const shape = [
    ...roughRect(inset, inset, side, side, { ...ICON, seed }),
    ...roughLine(mid, inset, mid, inset + side, { ...ICON, seed: seed + 1 }),
    ...roughLine(inset, mid, inset + side, mid, { ...ICON, seed: seed + 2 }),
  ];
  if (marked === undefined) return shape;
  const x = inset + (marked % 2) * half;
  const y = inset + Math.floor(marked / 2) * half;
  const fill = { ...ICON, seed: seed + 3, stroke: 'none', fill: 'currentColor', hachureGap: 2.2, fillWeight: 1.1 };
  return [...shape, ...roughRect(x + 1.5, y + 1.5, half - 3, half - 3, fill)];
}

const avg = (a: number, b: number) => (a + b) / 2;

/** Turns a perfect-freehand outline into a closed, filled SVG path. */
function pathFromOutline(points: number[][]): string {
  if (points.length < 4) return '';
  const f = (n: number) => n.toFixed(2);
  const [a, b, c] = points as [number[], number[], number[]];
  let d = `M${f(a[0]!)},${f(a[1]!)} Q${f(b[0]!)},${f(b[1]!)} ${f(avg(b[0]!, c[0]!))},${f(avg(b[1]!, c[1]!))} T`;
  for (let i = 2; i < points.length - 1; i++) {
    const [p, q] = [points[i]!, points[i + 1]!];
    d += `${f(avg(p[0]!, q[0]!))},${f(avg(p[1]!, q[1]!))} `;
  }
  return d + 'Z';
}

/** A felt-pen stroke through the points, `size` px across at full pressure. Fill it; don't stroke it. */
const inkPath = (points: number[][], size: number) =>
  pathFromOutline(getStroke(points, { size, thinning: 0.6, smoothing: 0.6, streamline: 0.4, simulatePressure: true, last: true }));

/** A felt-pen line between two points, with a little seeded wobble. */
export function inkLine(x1: number, y1: number, x2: number, y2: number, seed: number, size: number): string {
  const r = rng(seed);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(4, Math.round(len / 24));
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const points: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = (r() - 0.5) * 3;
    points.push([x1 + (x2 - x1) * t + nx * off, y1 + (y2 - y1) * t + ny * off]);
  }
  return inkPath(points, size);
}
