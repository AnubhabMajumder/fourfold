// The hand-drawn layers: decorative, aria-hidden SVG over or behind real controls and text, which keep all the
// meaning. Each shape is redrawn only when its element's size changes.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSettings } from '../settings/settings.ts';
import { BOX, cross, DELETE_MARK, gear, HATCHING, inkLine, miniList, miniMatrix, roughRect, roughStrike, swatch, tick, zigzag, type SketchPath } from './geometry.ts';

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

/** A block in a sketched box, sized to whatever the block ends up being. */
export function SketchPanel({ seed, children }: { seed: number; children: ReactNode }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const paths = useMemo(() => (w && h ? roughRect(2, 2, w - 4, h - 4, { ...BOX, seed }) : []), [w, h, seed]);
  return (
    <div ref={ref} className="sketch-panel">
      {children}
      <svg aria-hidden="true" width={w} height={h}>
        <Paths paths={paths} />
      </svg>
    </div>
  );
}

const SWATCH_SIZE = 26;

/** A colour scheme's swatch: its background, with a line of its ink and one of its strike. */
export function Swatch({ seed, bg, ink, strike }: { seed: number; bg: string; ink: string; strike: string }) {
  const paths = useMemo(() => swatch(SWATCH_SIZE, seed), [seed]);
  return (
    <svg aria-hidden="true" className="swatch" width={SWATCH_SIZE} height={SWATCH_SIZE}>
      <rect x={3} y={3} width={SWATCH_SIZE - 6} height={SWATCH_SIZE - 6} rx={3} fill={bg} />
      <Paths paths={paths.box} />
      <g color={ink}>
        <Paths paths={paths.ink} />
      </g>
      <g color={strike}>
        <Paths paths={paths.strike} />
      </g>
    </svg>
  );
}

/** A sketched mini-Matrix icon, with one Quadrant (its index in QUADRANTS) marked if given. */
export function MiniMatrix({ seed, marked, size = 18 }: { seed: number; marked?: number; size?: number }) {
  const paths = useMemo(() => miniMatrix(size, seed, marked), [size, seed, marked]);
  return (
    <svg aria-hidden="true" className="icon" width={size} height={size}>
      <Paths paths={paths} />
    </svg>
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

const GEAR_SIZE = 30;

/** The sketched gear of the settings button. */
export function Gear({ seed }: { seed: number }) {
  const paths = useMemo(() => gear(GEAR_SIZE, seed), [seed]);
  return (
    <svg aria-hidden="true" className="icon" width={GEAR_SIZE} height={GEAR_SIZE}>
      <Paths paths={paths} />
    </svg>
  );
}

/** A sketched mini Task List icon: a page with three lines. */
export function MiniList({ seed, size = 18 }: { seed: number; size?: number }) {
  const paths = useMemo(() => miniList(size, seed), [size, seed]);
  return (
    <svg aria-hidden="true" className="icon" width={size} height={size}>
      <Paths paths={paths} />
    </svg>
  );
}

const CHECKBOX_SIZE = 20;

/** The look of a checkbox: a sketched box, ticked in the strike colour when `checked`. The real checkbox is beside it. */
export function CheckboxMark({ seed, checked }: { seed: number; checked: boolean }) {
  const box = useMemo(() => roughRect(1.5, 1.5, CHECKBOX_SIZE - 3, CHECKBOX_SIZE - 3, { ...BOX, seed }), [seed]);
  const tickPaths = useMemo(() => tick(CHECKBOX_SIZE, seed + 1), [seed]);
  return (
    <svg aria-hidden="true" className="checkbox-mark" width={CHECKBOX_SIZE} height={CHECKBOX_SIZE}>
      <Paths paths={box} />
      {checked && (
        <g className="tick">
          <Paths paths={tickPaths} />
        </g>
      )}
    </svg>
  );
}

/**
 * Hatches an all-Completed Quadrant. Fills its positioned parent, the Quadrant's frame rather than its scrolling
 * list, so the whole Quadrant stays hatched however far the list is scrolled.
 */
export function Hatching({ seed }: { seed: number }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const paths = useMemo(() => (w && h ? roughRect(0, 0, w, h, { ...HATCHING, seed }) : []), [w, h, seed]);
  return (
    <div ref={ref} className="hatching" aria-hidden="true">
      <svg width={w} height={h}>
        <Paths paths={paths} />
      </svg>
    </div>
  );
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Whether the user has asked for reduced motion, kept up to date if they change it. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia(REDUCED_MOTION).matches);
  useEffect(() => {
    const query = matchMedia(REDUCED_MOTION);
    const change = () => setReduced(query.matches);
    change();
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return reduced;
}

/** One line of text, as laid out, relative to the text's box. */
type Line = { x: number; y: number; w: number; h: number };

/** The boxes of each line `text` is laid out on, relative to `box`. */
function measureLines(text: HTMLElement, box: HTMLElement): Line[] {
  const range = document.createRange();
  range.selectNodeContents(text);
  const base = box.getBoundingClientRect();
  const byTop = new Map<number, Line>();
  for (const r of range.getClientRects()) {
    if (r.width < 1) continue;
    const top = Math.round(r.top - base.top);
    const x = r.left - base.left;
    const line = byTop.get(top);
    if (!line) byTop.set(top, { x, y: r.top - base.top, w: r.width, h: r.height });
    else {
      const right = Math.max(line.x + line.w, x + r.width);
      line.x = Math.min(line.x, x);
      line.w = right - line.x;
    }
  }
  return [...byTop.values()];
}

/**
 * Where a strike is in its life: not there, there, being drawn on (only when the user completes the Task on screen,
 * never on load), or being rubbed out.
 */
type StrikePhase = 'none' | 'drawn' | 'drawing' | 'rubbing-out';

/**
 * Text struck through, while `done`, across each of its lines: with a felt-pen zigzag or a thick rough pencil line,
 * whichever strike style the user has chosen.
 *
 * The text stays real DOM text in the handwriting font, and the strike is a separate SVG layer drawn over it. Never
 * put an SVG turbulence or displacement filter on the text to make it look hand-drawn: filters warp the glyphs, hurt
 * readability, and don't exist in react-native-svg, which a later mobile app would draw with.
 */
/** `drawOn`: whether the user has just completed the Task, so that the strike is drawn on rather than shown already drawn. */
export function Strike({ seed, done, drawOn, children }: { seed: number; done: boolean; drawOn: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const { strike: style } = useSettings();
  const [was, setWas] = useState(done);
  const [phase, setPhase] = useState<StrikePhase>(done ? 'drawn' : 'none');
  const [styleWas, setStyleWas] = useState(style);
  if (style !== styleWas) {
    // A strike redrawn in another style appears already drawn: it's drawn on only as the user completes the Task.
    setStyleWas(style);
    if (phase === 'drawing') setPhase('drawn');
  }
  if (done !== was) {
    // Under reduced motion the strike appears already drawn, and goes at once. It's drawn on only when the user completes
    // the Task: not on load, nor when a refused un-complete snaps back, nor when a refresh finds it Completed.
    setWas(done);
    setPhase(done ? (reduced || !drawOn ? 'drawn' : 'drawing') : reduced ? 'none' : 'rubbing-out');
  }
  const shown = phase !== 'none' && !(reduced && phase === 'rubbing-out');

  const box = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  useLayoutEffect(() => {
    if (!shown) return;
    // Fonts are loaded before the first render (main.tsx), so only a resize can re-wrap the text.
    const measure = () => setLines(measureLines(text.current!, box.current!));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box.current!);
    return () => ro.disconnect();
  }, [shown, children]);

  const maskId = useId();
  const zigzags = useMemo(() => (style === 'zigzag' ? lines.map((l, i) => zigzag(l.x, l.y, l.w, l.h, seed + i)) : []), [style, lines, seed]);
  const roughLines = useMemo(
    () => (style === 'rough-line' ? lines.map((l, i) => roughStrike(l.x, l.y, l.w, l.h, seed + i)) : []),
    [style, lines, seed],
  );
  const drawing = phase === 'drawing' && !reduced;
  return (
    <span ref={box} className="strike">
      <span ref={text}>{children}</span>
      {shown && (
        <svg
          aria-hidden="true"
          className={phase === 'rubbing-out' ? `${style} rubbing-out` : style}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget && phase === 'rubbing-out') setPhase('none');
          }}
        >
          {roughLines.map((paths, i) => (
            // Wiped on from left to right, every line at once.
            <g key={i} className={drawing ? 'wiping-on' : undefined}>
              <Paths paths={paths} />
            </g>
          ))}
          {zigzags.map((z, i) => (
            <g key={i}>
              {drawing && (
                // Drawn on along the pen's path, every line at once: a mask follows the spine of the zigzag with a stroke-dash animation.
                <mask id={`${maskId}-${i}`}>
                  <path
                    d={z.spine}
                    className="drawing-on"
                    pathLength={1}
                    stroke="white"
                    strokeWidth={z.pen * 3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </mask>
              )}
              <path d={z.d} fill="currentColor" mask={drawing ? `url(#${maskId}-${i})` : undefined} />
            </g>
          ))}
        </svg>
      )}
    </span>
  );
}
