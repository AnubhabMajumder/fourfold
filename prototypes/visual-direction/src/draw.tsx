// PROTOTYPE: decorative, aria-hidden SVG layers. Meaning always lives in real DOM text/semantics.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { StrikeStyle } from './store';
import { gearDoodle, inkLine, roughLine, roughPolyline, roughRect, seedOf, zigzag, type SketchPath } from './sketch';

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

function Paths({ paths, className }: { paths: SketchPath[]; className?: string }) {
  return (
    <>
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke="currentColor"
          strokeWidth={p.strokeWidth}
          fill={p.fill && p.fill !== 'none' ? p.fill : 'none'}
          pathLength={1}
          className={className}
        />
      ))}
    </>
  );
}

type Line = { x: number; y: number; w: number; h: number };

/** Task text that gets a hand-drawn strike-through when completed. */
export function StrikeText({ id, text, done, style }: { id: string; text: string; done: boolean; style: StrikeStyle }) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  // Animate only when completion happens while on screen, never for Tasks already done on load.
  const doneOnMount = useRef(done);
  useEffect(() => {
    if (!done) doneOnMount.current = false;
  }, [done]);
  const animate = done && !doneOnMount.current;

  useLayoutEffect(() => {
    if (!done) return;
    const measure = () => {
      const range = document.createRange();
      range.selectNodeContents(textRef.current!);
      const base = wrapRef.current!.getBoundingClientRect();
      const byTop = new Map<number, Line>();
      for (const r of range.getClientRects()) {
        if (r.width < 1) continue;
        const key = Math.round(r.top - base.top);
        const prev = byTop.get(key);
        const x = r.left - base.left;
        if (prev) {
          const right = Math.max(prev.x + prev.w, x + r.width);
          prev.x = Math.min(prev.x, x);
          prev.w = right - prev.x;
        } else byTop.set(key, { x, y: r.top - base.top, w: r.width, h: r.height });
      }
      setLines([...byTop.values()]);
    };
    // Fonts are loaded before first render (main.tsx), so only resizes can re-wrap the text.
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrapRef.current!);
    return () => ro.disconnect();
  }, [done, style, text]);

  const seed = seedOf(id);
  const inner = <span ref={textRef}>{text}</span>;
  return (
    <span ref={wrapRef} className="strike-wrap">
      {done ? <s className="strike-none">{inner}</s> : inner}
      {done && (
        <svg className="strike-svg" aria-hidden="true">
          {lines.map((l, i) =>
            style === 'rough' ? (
              <g key={i} style={{ '--d': `${i * 0.25}s` } as CSSProperties}>
                <Paths
                  className={animate ? 'draw-on' : undefined}
                  paths={roughLine(l.x - 3, l.y + l.h * 0.58, l.x + l.w + 3, l.y + l.h * 0.5, {
                    seed: seed + i,
                    roughness: 1.6,
                    bowing: 2,
                    strokeWidth: 3.4,
                  })}
                />
              </g>
            ) : (
              <path
                key={i}
                d={zigzag(l.x, l.y, l.w, l.h, seed + i)}
                fill="currentColor"
                className={animate ? 'wipe-on' : undefined}
                style={{ '--d': `${i * 0.3}s` } as CSSProperties}
              />
            ),
          )}
        </svg>
      )}
    </span>
  );
}

export type DividerKind = 'pencil' | 'ink' | 'pencil-arrows';

/** The two intersecting lines that make the Matrix. Fills its positioned parent. */
export function Dividers({ kind, seed = 7, size = 5, m = 10 }: { kind: DividerKind; seed?: number; size?: number; m?: number }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const content = useMemo(() => {
    if (!w || !h) return null;
    if (kind === 'ink') {
      return (
        <>
          <path d={inkLine(w / 2, m, w / 2 + 3, h - m, seed, size)} fill="currentColor" />
          <path d={inkLine(m, h / 2 + 2, w - m, h / 2 - 2, seed + 1, size)} fill="currentColor" />
        </>
      );
    }
    const o = { roughness: 1.3, bowing: 1.2, strokeWidth: kind === 'pencil' ? 1.4 : 2.2 };
    const lines = [
      ...roughLine(w / 2, m, w / 2 + 2, h - m, { ...o, seed }),
      ...roughLine(m, h / 2 + 2, w - m, h / 2 - 1, { ...o, seed: seed + 1 }),
    ];
    if (kind === 'pencil-arrows') {
      // Arrowheads: top of the vertical (more important), left of the horizontal (more urgent).
      lines.push(
        ...roughPolyline([[w / 2 - 9, m + 12], [w / 2, m], [w / 2 + 10, m + 11]], { ...o, seed: seed + 2 }),
        ...roughPolyline([[m + 12, h / 2 - 8], [m, h / 2 + 2], [m + 12, h / 2 + 11]], { ...o, seed: seed + 3 }),
      );
    }
    return <Paths paths={lines} />;
  }, [w, h, kind, seed, size, m]);
  return (
    <div ref={ref} className="dividers" aria-hidden="true">
      <svg width={w} height={h}>
        {content}
      </svg>
    </div>
  );
}

/** Wraps children in a sketchy rectangle, sized to whatever the children end up being. */
export function RoughBox({
  seed,
  children,
  className = '',
  fill,
  roughness = 1.2,
}: {
  seed: number;
  children?: ReactNode;
  className?: string;
  fill?: string;
  roughness?: number;
}) {
  const [ref, { w, h }] = useSize<HTMLSpanElement>();
  const paths = useMemo(
    () =>
      w && h
        ? roughRect(2, 2, w - 4, h - 4, { seed, roughness, bowing: 1, strokeWidth: 1.5, fill, fillStyle: 'hachure', hachureGap: 6, fillWeight: 1 })
        : [],
    [w, h, seed, fill, roughness],
  );
  return (
    <span ref={ref} className={`roughbox ${className}`}>
      {children}
      <svg className="roughbox-svg" aria-hidden="true" width={w} height={h}>
        <Paths paths={paths} />
      </svg>
    </span>
  );
}

export function RoughCheck({ seed }: { seed: number }) {
  return (
    <svg className="rough-check" aria-hidden="true" viewBox="0 0 24 24">
      <Paths paths={roughPolyline([[4, 13], [10, 20], [22, 2]], { seed, roughness: 1.2, strokeWidth: 2.4 })} />
    </svg>
  );
}

/** Hand-drawn × for deleting a Task. */
export function DeleteIcon({ seed }: { seed: number }) {
  const paths = useMemo(() => {
    const o = { roughness: 0.9, bowing: 0.6, strokeWidth: 1.6, disableMultiStroke: true };
    return [...roughLine(3, 3, 15, 15, { ...o, seed }), ...roughLine(15, 3, 3, 15, { ...o, seed: seed + 1 })];
  }, [seed]);
  return (
    <svg className="quad-icon" viewBox="0 0 18 18" aria-hidden="true">
      <Paths paths={paths} />
    </svg>
  );
}

/** Mini Matrix with the target Quadrant filled in: tells you where a placement button puts the Task. */
export function QuadIcon({ q, seed }: { q: number; seed: number }) {
  const paths = useMemo(() => {
    const o = { seed, roughness: 0.8, bowing: 0.5, strokeWidth: 1.3 };
    return [
      ...roughRect(1, 1, 16, 16, o),
      ...roughRect(q % 2 ? 10 : 3, q < 2 ? 3 : 10, 5, 5, { ...o, fill: 'currentColor', fillStyle: 'solid' }),
    ];
  }, [q, seed]);
  return (
    <svg className="quad-icon" viewBox="0 0 18 18" aria-hidden="true">
      <Paths paths={paths} />
    </svg>
  );
}

/** Sketched 2x2 Matrix with nothing filled in: the Task List's "place" button. */
export function PlaceIcon({ seed }: { seed: number }) {
  const paths = useMemo(() => {
    const o = { roughness: 0.8, bowing: 0.5, strokeWidth: 1.4 };
    return [...roughRect(1, 1, 16, 16, { ...o, seed }), ...roughLine(9, 2, 9, 16, { ...o, seed: seed + 1 }), ...roughLine(2, 9, 16, 9, { ...o, seed: seed + 2 })];
  }, [seed]);
  return (
    <svg className="quad-icon" viewBox="0 0 18 18" aria-hidden="true">
      <Paths paths={paths} />
    </svg>
  );
}

/**
 * Sketched mini Task List (a page with three lines) for sending a Task back to the Task List: the partner of the
 * mini-Matrix PlaceIcon, so the two buttons read as "to the Matrix" and "to the list".
 */
export function ReturnIcon({ seed }: { seed: number }) {
  const paths = useMemo(() => {
    const o = { roughness: 0.8, bowing: 0.5, strokeWidth: 1.4 };
    return [
      ...roughRect(2, 1, 14, 16, { ...o, seed }),
      ...[5, 9, 13].flatMap((y, i) => roughLine(5, y, i === 2 ? 10 : 13, y, { ...o, seed: seed + 1 + i, disableMultiStroke: true })),
    ];
  }, [seed]);
  return (
    <svg className="quad-icon" viewBox="0 0 18 18" aria-hidden="true">
      <Paths paths={paths} />
    </svg>
  );
}

/** A gear doodled in felt pen, in the same hand as the Matrix lines and the strike. */
export function GearIcon({ seed }: { seed: number }) {
  const ds = useMemo(() => gearDoodle(seed), [seed]);
  return (
    <svg className="gear-icon" viewBox="0 0 32 32" aria-hidden="true">
      {ds.map((d, i) => (
        <path key={i} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}

/**
 * Hatches a Quadrant whose Tasks are all Completed. Fills its positioned parent (the Quadrant's frame, not its
 * scrolling list), so the whole visible Quadrant stays hatched however far it is scrolled.
 */
export function QuadrantDone({ seed }: { seed: number }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  // Fade in only when the last Task gets completed on screen, not when a finished Quadrant is first shown.
  const [animate] = useState(() => performance.now() > 1500);
  const content = useMemo(() => {
    if (!w || !h) return null;
    const fill = roughRect(6, 6, w - 12, h - 12, { seed, roughness: 1.4, stroke: 'none', fill: 'currentColor', fillStyle: 'hachure', hachureAngle: -41, hachureGap: 16, fillWeight: 1.4 });
    return <Paths paths={fill.filter((p) => p.stroke !== 'none')} />;
  }, [w, h, seed]);
  return (
    <div ref={ref} className={`quad-done${animate ? ' fade-in' : ''}`} aria-hidden="true">
      <svg width={w} height={h}>{content}</svg>
    </div>
  );
}
