// The hand-drawn layers: decorative, aria-hidden SVG over or behind real controls and text, which keep all the
// meaning. Each shape is redrawn only when its element's size changes.
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BOX, cross, DELETE_MARK, inkLine, roughRect, type SketchPath } from './geometry.ts';

/** An element's size, kept up to date as it resizes. */
function useSize<T extends HTMLElement>() {
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

function Paths({ paths }: { paths: SketchPath[] }) {
  return paths.map((p, i) => (
    <path key={i} d={p.d} stroke="currentColor" strokeWidth={p.strokeWidth} fill="none" />
  ));
}

/** Wraps a control in a sketched box, sized to whatever the control ends up being. */
export function SketchBox({ seed, className = '', children }: { seed: number; className?: string; children: ReactNode }) {
  const [ref, { w, h }] = useSize<HTMLSpanElement>();
  const paths = useMemo(() => (w && h ? roughRect(2, 2, w - 4, h - 4, { ...BOX, seed }) : []), [w, h, seed]);
  return (
    <span ref={ref} className={`sketch-box ${className}`}>
      {children}
      <svg aria-hidden="true" width={w} height={h}>
        <Paths paths={paths} />
      </svg>
    </span>
  );
}

const DELETE_SIZE = 14;

/** The sketched × of a delete button. */
export function DeleteMark({ seed }: { seed: number }) {
  const paths = useMemo(() => cross(DELETE_SIZE, seed, DELETE_MARK), [seed]);
  return (
    <svg aria-hidden="true" width={DELETE_SIZE} height={DELETE_SIZE}>
      <Paths paths={paths} />
    </svg>
  );
}

/** The felt pen's full-pressure width; it thins as it moves, drawing lines about 2.2px wide. */
const DIVIDER_PEN = 5;

/** The Matrix's two felt-pen dividers, crossing in the middle. Fills its positioned parent. */
export function Dividers({ seed }: { seed: number }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const inset = 10;
  const lines = useMemo(
    () =>
      w && h
        ? [
            inkLine(w / 2, inset, w / 2 + 3, h - inset, seed, DIVIDER_PEN),
            inkLine(inset, h / 2 + 2, w - inset, h / 2 - 2, seed + 1, DIVIDER_PEN),
          ]
        : [],
    [w, h, seed],
  );
  return (
    <div ref={ref} className="dividers" aria-hidden="true">
      <svg width={w} height={h}>
        {lines.map((d, i) => (
          <path key={i} d={d} fill="currentColor" />
        ))}
      </svg>
    </div>
  );
}
