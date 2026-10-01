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
  notRunning: 41,
  /** The hatching of an all-Completed Quadrant; each Quadrant adds its index in QUADRANTS. */
  hatching: 51,
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

/** The pencil for the delete ×: one stroke per line, not rough.js's usual double stroke. */
export const DELETE_MARK: Options = { roughness: 0.9, bowing: 0.6, strokeWidth: 1.6, disableMultiStroke: true };

/** The pencil for a checkbox's tick, drawn in the strike colour. */
export const TICK: Options = { roughness: 1.2, strokeWidth: 2.4 };

/** The hatching across an all-Completed Quadrant, in the strike colour. */
export const HATCHING: Options = {
  roughness: 1.4,
  stroke: 'none',
  fill: 'currentColor',
  fillStyle: 'hachure',
  hachureAngle: -41,
  hachureGap: 16,
  fillWeight: 1.4,
};

const paths = (drawable: ReturnType<typeof gen.rectangle>): SketchPath[] =>
  gen
    .toPaths(drawable)
    .filter((p) => p.stroke !== 'none')
    .map((p) => ({ d: p.d, strokeWidth: p.strokeWidth }));

export const roughRect = (x: number, y: number, w: number, h: number, o: SketchOptions) => paths(gen.rectangle(x, y, w, h, o));

const roughLine = (x1: number, y1: number, x2: number, y2: number, o: SketchOptions) => paths(gen.line(x1, y1, x2, y2, o));

/** A checkbox's tick filling a `size` square: one polyline, short stroke down then long stroke up. */
export const tick = (size: number, seed: number) =>
  paths(
    gen.linearPath(
      [
        [size * 0.17, size * 0.54],
        [size * 0.42, size * 0.83],
        [size * 0.92, size * 0.08],
      ],
      { ...TICK, seed },
    ),
  );

/** A mini Task List, `size` px square: a page with three lines, the partner of the mini-Matrix. */
export function miniList(size: number, seed: number): SketchPath[] {
  const s = size / 18;
  const line = { ...ICON, disableMultiStroke: true };
  return [
    ...roughRect(2 * s, 1 * s, 14 * s, 16 * s, { ...ICON, seed }),
    ...[5, 9, 13].flatMap((y, i) => roughLine(5 * s, y * s, (i === 2 ? 10 : 13) * s, y * s, { ...line, seed: seed + 1 + i })),
  ];
}

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

/** A sketched × filling a `size` square: two crossing strokes, each with its own seed. */
export const cross = (size: number, seed: number, o: Options) => [
  ...roughLine(2, 2, size - 2, size - 2, { ...o, seed }),
  ...roughLine(size - 2, 2, 2, size - 2, { ...o, seed: seed + 1 }),
];

const avg = (a: number, b: number) => (a + b) / 2;

/** A coordinate as it is written into a path, to two decimal places. */
const coord = (n: number) => n.toFixed(2);

/** Turns a perfect-freehand outline into a closed, filled SVG path. */
function pathFromOutline(points: number[][]): string {
  if (points.length < 4) return '';
  const [a, b, c] = points as [number[], number[], number[]];
  let d = `M${coord(a[0]!)},${coord(a[1]!)} Q${coord(b[0]!)},${coord(b[1]!)} ${coord(avg(b[0]!, c[0]!))},${coord(avg(b[1]!, c[1]!))} T`;
  for (let i = 2; i < points.length - 1; i++) {
    const [p, q] = [points[i]!, points[i + 1]!];
    d += `${coord(avg(p[0]!, q[0]!))},${coord(avg(p[1]!, q[1]!))} `;
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

/**
 * The felt-pen `|/|/|/|` zigzag struck through one line of text, the line's box being `x, y, w, h`: uneven teeth, a
 * drifting baseline and leaning down strokes. It starts the way it ends, with a down stroke, so both ends look alike.
 * Gives the ink to fill (`d`), and the path the pen took (`spine`), along which the strike is drawn on.
 */
export function zigzag(x: number, y: number, w: number, h: number, seed: number): { d: string; spine: string; pen: number } {
  const r = rng(seed);
  const jit = (n: number) => (r() - 0.5) * n;
  const top = y + h * 0.18;
  const bottom = y + h * 0.88;
  // The whole stroke rises or sinks a little from left to right.
  const drift = jit(h * 0.2);
  const lift = (cx: number) => ((cx - x) / Math.max(w, 1)) * drift;
  const end = x + w + 3;
  let cx = x - 1;
  const corners: number[][] = [
    [cx + jit(2), top + jit(h * 0.14)],
    [cx - 1.5 - r() * 2.5, bottom + jit(h * 0.12)],
  ];
  while (cx < end) {
    cx = Math.min(cx + h * (0.6 + r() * 0.2), end);
    corners.push([cx + jit(2), top + lift(cx) + jit(h * 0.14)]);
    corners.push([cx - 1.5 - r() * 2.5, bottom + lift(cx) + jit(h * 0.12)]);
  }
  // A little wobble along each stroke, so the corners stay sharp but the lines aren't ruler-straight.
  const points: number[][] = [corners[0]!];
  for (let i = 1; i < corners.length; i++) {
    const [ax, ay] = corners[i - 1] as [number, number];
    const [bx, by] = corners[i] as [number, number];
    for (const t of [0.35, 0.7]) points.push([ax + (bx - ax) * t + jit(1.2), ay + (by - ay) * t + jit(1.2)]);
    points.push(corners[i]!);
  }
  const pen = Math.max(2.8, h * 0.115);
  const outline = getStroke(points, { size: pen, thinning: 0.15, smoothing: 0.25, streamline: 0.15, simulatePressure: false, last: true });
  const spine = 'M' + points.map(([px, py]) => `${coord(px!)},${coord(py!)}`).join(' L');
  return { d: pathFromOutline(outline), spine, pen };
}
