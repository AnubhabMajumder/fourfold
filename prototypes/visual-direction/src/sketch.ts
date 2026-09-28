// PROTOTYPE: seeded hand-drawn geometry. Pure functions returning SVG path strings (see research #3).
import rough from 'roughjs';
import { getStroke } from 'perfect-freehand';
import type { Options } from 'roughjs/bin/core';

const gen = rough.generator();

export function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2147483646) + 1;
}

export function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SketchPath = { d: string; stroke: string; strokeWidth: number; fill?: string };

const paths = (drawable: ReturnType<typeof gen.line>): SketchPath[] =>
  gen.toPaths(drawable).map((p) => ({ d: p.d, stroke: p.stroke, strokeWidth: p.strokeWidth, fill: p.fill }));

export const roughLine = (x1: number, y1: number, x2: number, y2: number, o: Options) =>
  paths(gen.line(x1, y1, x2, y2, o));

export const roughRect = (x: number, y: number, w: number, h: number, o: Options) =>
  paths(gen.rectangle(x, y, w, h, o));

export const roughPolyline = (pts: [number, number][], o: Options) => paths(gen.linearPath(pts, o));

const avg = (a: number, b: number) => (a + b) / 2;

function pathFromStroke(points: number[][]): string {
  const len = points.length;
  if (len < 4) return '';
  let a = points[0];
  let b = points[1];
  const c = points[2];
  let d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${avg(b[0], c[0]).toFixed(2)},${avg(b[1], c[1]).toFixed(2)} T`;
  for (let i = 2; i < len - 1; i++) {
    a = points[i];
    b = points[i + 1];
    d += `${avg(a[0], b[0]).toFixed(2)},${avg(a[1], b[1]).toFixed(2)} `;
  }
  return d + 'Z';
}

export const inkPath = (pts: number[][], size: number) =>
  pathFromStroke(getStroke(pts, { size, thinning: 0.6, smoothing: 0.6, streamline: 0.4, simulatePressure: true, last: true }));

/** A felt-pen line between two points, with a little seeded wobble. */
export function inkLine(x1: number, y1: number, x2: number, y2: number, seed: number, size: number): string {
  const r = rng(seed);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(4, Math.round(len / 24));
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const pts: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = (r() - 0.5) * 3;
    pts.push([x1 + (x2 - x1) * t + nx * off, y1 + (y2 - y1) * t + ny * off]);
  }
  return inkPath(pts, size);
}

/** Tight back-and-forth scribble across one line box of text. */
export function scribble(x: number, y: number, w: number, h: number, seed: number): string {
  const r = rng(seed);
  const mid = y + h * 0.55;
  const amp = h * 0.2;
  const pts: number[][] = [[x - 3, mid + (r() - 0.5) * amp]];
  let cx = x - 3;
  let up = true;
  while (cx < x + w + 3) {
    cx += 6 + r() * 6;
    pts.push([Math.min(cx, x + w + 3), mid + (up ? -1 : 1) * amp * (0.6 + r() * 0.6)]);
    up = !up;
  }
  return inkPath(pts, Math.max(2, h * 0.11));
}

/** Pencil zigzag across one line box of text, drawn like /|/|/| (up-slash, drop straight down). */
export function zigzag(x: number, y: number, w: number, h: number, seed: number): SketchPath[] {
  const top = y + h * 0.3;
  const bottom = y + h * 0.78;
  const step = Math.max(8, h * 0.7);
  const end = x + w + 2;
  const pts: [number, number][] = [[x - 2, bottom]];
  for (let cx = x - 2; cx < end; ) {
    cx = Math.min(cx + step, end);
    pts.push([cx, top], [cx, bottom]);
  }
  return roughPolyline(pts, { seed, roughness: 0.6, bowing: 0.3, strokeWidth: 1.3, disableMultiStroke: true });
}
