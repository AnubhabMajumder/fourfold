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

export const roughCircle = (x: number, y: number, d: number, o: Options) => paths(gen.circle(x, y, d, o));

export const roughPolyline = (pts: [number, number][], o: Options) => paths(gen.linearPath(pts, o));

export const roughCurve = (pts: [number, number][], o: Options) => paths(gen.curve(pts, o));

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

/**
 * The felt-pen |/|/|/| zigzag: uneven teeth, drifting baseline, down strokes that lean.
 * It starts the way it ends, with a down stroke, so both ends of the line look alike.
 */
export function zigzag(x: number, y: number, w: number, h: number, seed: number): string {
  const r = rng(seed);
  const jit = (n: number) => (r() - 0.5) * n;
  const top = y + h * 0.18;
  const bottom = y + h * 0.88;
  const drift = jit(h * 0.2); // the whole stroke rises or sinks a little from left to right
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
  // Wobble along each stroke so the corners stay sharp but the lines aren't ruler-straight.
  const pts: number[][] = [corners[0]];
  for (let i = 1; i < corners.length; i++) {
    const [ax, ay] = corners[i - 1];
    const [bx, by] = corners[i];
    for (const t of [0.35, 0.7]) pts.push([ax + (bx - ax) * t + jit(1.2), ay + (by - ay) * t + jit(1.2)]);
    pts.push(corners[i]);
  }
  const outline = getStroke(pts, { size: Math.max(2.8, h * 0.115), thinning: 0.15, smoothing: 0.25, streamline: 0.15, simulatePressure: false, last: true });
  return pathFromStroke(outline);
}

/**
 * A gear doodled with the felt pen: one wobbly stroke round chunky, uneven teeth that overshoots where it
 * started, and a hub looped a little more than once. Returns filled outline paths in a 32x32 box.
 */
export function gearDoodle(seed: number): string[] {
  const r = rng(seed);
  const jit = (n: number) => (r() - 0.5) * n;
  const c = 16;
  const at = (a: number, rad: number): number[] => [c + Math.cos(a) * rad + jit(1.3), c + Math.sin(a) * rad + jit(1.3)];
  const teeth = 7;
  const tilt = r() * Math.PI;
  const corners: number[][] = [];
  for (let i = 0; i < teeth; i++) {
    const a = tilt + (i / teeth) * Math.PI * 2 + jit(0.1);
    const tip = 13.4 + jit(1.4);
    corners.push(at(a - 0.31, 9.2), at(a - 0.16, tip), at(a + 0.16, tip), at(a + 0.31, 9.2));
  }
  // Carry on past the start along the first edge, the way a quick doodle never closes exactly.
  const [p0, p1] = corners;
  corners.push(p0, [p0[0] + (p1[0] - p0[0]) * 0.6 + 0.8, p0[1] + (p1[1] - p0[1]) * 0.6 + 0.8]);
  const pts: number[][] = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[i + 1];
    pts.push(corners[i], [ax + (bx - ax) * 0.5 + jit(0.9), ay + (by - ay) * 0.5 + jit(0.9)]);
  }
  pts.push(corners[corners.length - 1]);
  // The hub: a quick loop that goes round a bit more than once and doesn't land on itself.
  const hub: number[][] = [];
  const a0 = r() * Math.PI * 2;
  for (let i = 0; i <= 16; i++) {
    const a = a0 + (i / 12.5) * Math.PI * 2;
    const rad = 4 + i * 0.06 + jit(0.5);
    hub.push([c + 0.4 + Math.cos(a) * rad, c + Math.sin(a) * rad]);
  }
  const pen = { thinning: 0.5, smoothing: 0.15, streamline: 0.1, simulatePressure: true, last: true };
  return [
    pathFromStroke(getStroke(pts, { ...pen, size: 3.2, start: { taper: 3 }, end: { taper: 7 } })),
    pathFromStroke(getStroke(hub, { ...pen, size: 2.8, start: { taper: 2 }, end: { taper: 5 } })),
  ];
}
