// PROTOTYPE variant D: the user's picks from A/B/C (#8 feedback).
// A's partitioning (header / Task List / Matrix, input and Add apart), B's axis headers,
// C's sketched look everywhere, drag-and-drop placement with a place icon that opens four small Quadrant buttons as the fallback.
// Colour schemes live behind the sketched settings gear in the Matrix's bottom-right corner, mirrored in the URL.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { DATE } from '../bits';
import { DeleteIcon, Dividers, GearIcon, PlaceIcon, QuadIcon, QuadrantDone, ReturnIcon, RoughBox, RoughCheck, StrikeText } from '../draw';
import { seedOf } from '../sketch';
import { QUADRANTS, type QuadrantIndex, type Store, type Task, type VariantProps } from '../store';

export const name = 'Your picks';

// The keepers: plain, ivory with navy or black, chalkboard, and noir with a cobalt strike or steel lines.
const THEMES = {
  plain: { label: 'Plain', group: 'Plain' },
  'ivory-navy': { label: 'navy', group: 'Ivory' },
  'ivory-black': { label: 'black', group: 'Ivory' },
  'noir-chalk': { label: 'chalkboard', group: 'Dark' },
  'noir-blue-cobalt': { label: 'cobalt strike', group: 'NoirBlue' },
  'noir-blue-steel': { label: 'steel lines', group: 'NoirBlue' },
} as const;
type Theme = keyof typeof THEMES;

/** A setting that lives in a URL search param, so a refresh or a shared link keeps it. */
function useUrlParam<T extends string>(key: string, options: Record<T, unknown>, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    const v = new URLSearchParams(location.search).get(key);
    return v && v in options ? (v as T) : fallback;
  });
  const set = (v: T) => {
    const url = new URL(location.href);
    url.searchParams.set(key, v);
    history.replaceState(null, '', url);
    setValue(v);
  };
  return [value, set] as const;
}

type Zone = QuadrantIndex | 'list';
type Drag = { id: string; text: string; x: number; y: number; dx: number; dy: number; w: number; zone: Zone | null; index: number };

/** Which drop zone is under the pointer, and before which of its Tasks (excluding the dragged one) it lands. */
function hitTest(x: number, y: number, id: string): { zone: Zone | null; index: number } {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]');
  if (!el) return { zone: null, index: 0 };
  const items = [...el.querySelectorAll<HTMLElement>('li[data-id]')].filter((li) => li.dataset.id !== id);
  let index = items.findIndex((li) => {
    const r = li.getBoundingClientRect();
    return y < r.top + r.height / 2;
  });
  if (index < 0) index = items.length;
  const z = el.dataset.drop!;
  return { zone: z === 'list' ? 'list' : (Number(z) as QuadrantIndex), index };
}

function useDragPlace(store: Store) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const start = (e: ReactPointerEvent<HTMLElement>, t: Task) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, input, label, .vd-pop')) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const rect = e.currentTarget.getBoundingClientRect();
    let cur: Drag | null = null;
    const move = (ev: PointerEvent) => {
      if (!cur && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      ev.preventDefault();
      cur = { id: t.id, text: t.text, x: ev.clientX, y: ev.clientY, dx: sx - rect.left, dy: sy - rect.top, w: rect.width, ...hitTest(ev.clientX, ev.clientY, t.id) };
      setDrag(cur);
    };
    const end = (drop: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      document.body.classList.remove('vd-dragging');
      if (drop && cur?.zone != null) store.move(t.id, cur.zone === 'list' ? null : cur.zone, cur.index);
      setDrag(null);
    };
    const up = () => end(true);
    const cancel = () => end(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    document.body.classList.add('vd-dragging');
  };
  return { drag, start };
}

/** Renders a zone's Tasks with the drop line inserted where the dragged Task would land. */
function withDropLine(tasks: Task[], zone: Zone, drag: Drag | null, item: (t: Task) => ReactNode) {
  const line = <li key="drop-line" className="vd-drop-line" aria-hidden="true" />;
  if (drag?.zone !== zone) return tasks.map(item);
  const out: ReactNode[] = [];
  let i = 0;
  for (const t of tasks) {
    if (t.id !== drag.id && i++ === drag.index) out.push(line);
    out.push(item(t));
  }
  if (drag.index >= i) out.push(line);
  return out;
}

/** Closes a popover on Escape or a pointerdown outside it (and outside its opener). */
function useDismiss(open: boolean, close: () => void, ...refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!refs.some((r) => r.current?.contains(e.target as Node))) close();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
    };
  });
}

/** Sketched × that deletes the Task outright (no undo in the prototype). Task List only. */
function DeleteButton({ store, t }: { store: Store; t: Task }) {
  return (
    <button className="vd-delete" onClick={() => store.remove(t.id)} title="Delete Task" aria-label={`Delete ${t.text}`}>
      <DeleteIcon seed={seedOf(t.id) + 9} />
    </button>
  );
}

/** Sketched mini-Matrix icon; clicking it swaps in four small Quadrant buttons (appends the Task to that Quadrant). */
function PlacePicker({ store, t }: { store: Store; t: Task }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useDismiss(open, () => setOpen(false), box);
  useEffect(() => {
    if (open) box.current?.querySelector('button')?.focus();
  }, [open]);
  if (!open)
    return (
      <span ref={box} className="vd-actions">
        <DeleteButton store={store} t={t} />
        <button className="vd-placebtn" onClick={() => setOpen(true)} aria-expanded={false} title="Place in the Matrix" aria-label={`Place ${t.text}`}>
          <PlaceIcon seed={seedOf(t.id) + 3} />
        </button>
      </span>
    );
  return (
    <span ref={box} className="vd-actions place-buttons" role="group" aria-label={`Place ${t.text} into`}>
      {QUADRANTS.map((q, i) => (
        <button key={i} title={q.label} aria-label={q.label} onClick={() => store.place(t.id, i as QuadrantIndex)}>
          <QuadIcon q={i} seed={seedOf(t.id) + i} />
        </button>
      ))}
    </span>
  );
}

/** Sketched gear sitting in the Matrix's bottom-right corner; opens the colour schemes above it. */
function Settings({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const [at, setAt] = useState<{ right: number; bottom: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useDismiss(at !== null, () => setAt(null), btn, pop);
  const toggle = () => {
    if (at) return setAt(null);
    const r = btn.current!.getBoundingClientRect();
    setAt({ right: Math.max(8, innerWidth - r.right), bottom: innerHeight - r.top + 6 });
  };
  const groups = { Plain: '', Ivory: 'ivory &', Dark: 'dark', NoirBlue: 'noir &' };
  return (
    <>
      <button ref={btn} className="vd-gear" onClick={toggle} aria-expanded={at !== null} aria-label="Settings" title="Settings">
        <GearIcon seed={41} />
      </button>
      {at && (
        <div ref={pop} className="vd-pop vd-settings" style={at} role="dialog" aria-label="Settings">
          <h2>Colours</h2>
          {(Object.keys(groups) as (keyof typeof groups)[]).map((g) => (
            <div key={g} className="vd-swatches">
              {groups[g] && <span className="vd-group">{groups[g]}</span>}
              {(Object.keys(THEMES) as Theme[])
                .filter((k) => THEMES[k].group === g)
                .map((k) => (
                  <button key={k} className={`vd-swatch${k === theme ? ' on' : ''}`} data-theme={k} aria-pressed={k === theme} onClick={() => setTheme(k)}>
                    <span className="vd-swatch-chip" aria-hidden="true">
                      <i />
                      <b />
                    </span>
                    {THEMES[k].label}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function Variant({ store, strike, headerNote, belowHeader, overlay, paused }: VariantProps) {
  const { drag, start } = useDragPlace(store);
  const [text, setText] = useState('');
  const [theme, setTheme] = useUrlParam<Theme>('theme', THEMES, 'plain');
  const draggable = (t: Task) => ({
    'data-id': t.id,
    className: drag?.id === t.id ? 'dragging' : undefined,
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => start(e, t),
  });

  return (
    <div className="vd" data-theme={theme}>
      <header className="vd-top">
        <h1>Fourfold</h1>
        {headerNote}
        <nav className="vd-date">
          <RoughBox seed={11} className="vd-btn">
            <button aria-label="Previous date">‹</button>
          </RoughBox>
          <span>{DATE}</span>
          <RoughBox seed={12} className="vd-btn">
            <button aria-label="Next date">›</button>
          </RoughBox>
        </nav>
      </header>
      {belowHeader}
      <div className="vd-body" inert={paused} data-paused={paused || undefined}>
        <aside className={`vd-page vd-list${drag?.zone === 'list' ? ' over' : ''}`} data-drop="list" aria-labelledby="vd-list">
          <h2 id="vd-list">Task List</h2>
          <form
            className="vd-add"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) store.add(text.trim());
              setText('');
            }}
          >
            <RoughBox seed={21} className="vd-input">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a Task…" aria-label="New Task" />
            </RoughBox>
            <RoughBox seed={22} className="vd-addbtn">
              <button type="submit">add</button>
            </RoughBox>
          </form>
          <ul>
            {withDropLine(store.list, 'list', drag, (t) => (
              <li key={t.id} {...draggable(t)}>
                <span className="vd-text">{t.text}</span>
                <PlacePicker store={store} t={t} />
              </li>
            ))}
          </ul>
          {store.list.length === 0 && <p className="vd-empty">all placed ✓</p>}
        </aside>
        <section className="vd-page vd-matrixpage" aria-label={`Matrix for ${DATE}`}>
          <div className="vd-axis-top" aria-hidden="true">
            <span>urgent</span>
            <span>not urgent</span>
          </div>
          <div className="vd-axis-left" aria-hidden="true">
            <span>important</span>
            <span>not important</span>
          </div>
          <main className="vd-matrix">
            <Dividers kind="ink" seed={31} />
            {QUADRANTS.map((q, i) => {
              const tasks = store.inQuadrant(i as QuadrantIndex);
              const complete = tasks.length > 0 && tasks.every((t) => t.done);
              return (
                <section key={i} className={`vd-q${drag?.zone === i ? ' over' : ''}${complete ? ' complete' : ''}`} data-drop={i} aria-label={complete ? `${q.label}, all done` : q.label}>
                  {complete && <QuadrantDone seed={51 + i} />}
                  <ul className="vd-q-list">
                    {withDropLine(tasks, i as QuadrantIndex, drag, (t) => (
                      <li key={t.id} {...draggable(t)}>
                        <label className="vd-check">
                          <input type="checkbox" className="sr-only" checked={t.done} onChange={() => store.toggle(t.id)} aria-label={`Completed: ${t.text}`} />
                          <RoughBox seed={seedOf(t.id)} className="vd-box">
                            {t.done && <RoughCheck seed={seedOf(t.id) + 5} />}
                          </RoughBox>
                        </label>
                        <StrikeText id={t.id} text={t.text} done={t.done} style={strike} />
                        <button className="vd-return" onClick={() => store.unplace(t.id)} title="Return to Task List" aria-label={`Return ${t.text} to Task List`}>
                          <ReturnIcon seed={seedOf(t.id) + 7} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            <Settings theme={theme} setTheme={setTheme} />
          </main>
        </section>
      </div>
      {overlay}
      {drag && (
        <div className="vd-ghost" style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: Math.min(drag.w, 360) }} aria-hidden="true">
          {drag.text}
        </div>
      )}
    </div>
  );
}
