// PROTOTYPE variant D: the user's picks from A/B/C (#8 feedback).
// A's partitioning (header / Task List / Matrix, input and Add apart), B's axis headers,
// C's sketched look everywhere, drag-and-drop placement with B-style quadrant buttons as the fallback.
import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { DATE } from '../bits';
import { DeleteIcon, Dividers, QuadIcon, RoughBox, RoughCheck, StrikeText } from '../draw';
import { seedOf } from '../sketch';
import { QUADRANTS, type QuadrantIndex, type Store, type Task, type VariantProps } from '../store';

export const name = 'Your picks';

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
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, input, label')) return;
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

/** Sketched × that deletes the Task outright (no undo in the prototype). */
function DeleteButton({ store, t }: { store: Store; t: Task }) {
  return (
    <button className="vd-delete" onClick={() => store.remove(t.id)} title="Delete Task" aria-label={`Delete ${t.text}`}>
      <DeleteIcon seed={seedOf(t.id) + 9} />
    </button>
  );
}

export function Variant({ store, strike }: VariantProps) {
  const { drag, start } = useDragPlace(store);
  const [text, setText] = useState('');
  const draggable = (t: Task) => ({
    'data-id': t.id,
    className: drag?.id === t.id ? 'dragging' : undefined,
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => start(e, t),
  });

  return (
    <div className="vd">
      <header className="vd-top">
        <h1>Fourfold</h1>
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
      <div className="vd-body">
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
                <span>{t.text}</span>
                <span className="place-buttons">
                  {QUADRANTS.map((q, i) => (
                    <button key={i} title={`Place into ${q.label}`} aria-label={`Place into ${q.label}`} onClick={() => store.place(t.id, i as QuadrantIndex)}>
                      <QuadIcon q={i} seed={seedOf(t.id) + i} />
                    </button>
                  ))}
                  <DeleteButton store={store} t={t} />
                </span>
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
            {QUADRANTS.map((q, i) => (
              <section key={i} className={`vd-q${drag?.zone === i ? ' over' : ''}`} data-drop={i} aria-label={q.label}>
                <ul>
                  {withDropLine(store.inQuadrant(i as QuadrantIndex), i as QuadrantIndex, drag, (t) => (
                    <li key={t.id} {...draggable(t)}>
                      <label className="vd-check">
                        <input type="checkbox" className="sr-only" checked={t.done} onChange={() => store.toggle(t.id)} aria-label={`Completed: ${t.text}`} />
                        <RoughBox seed={seedOf(t.id)} className="vd-box">
                          {t.done && <RoughCheck seed={seedOf(t.id) + 5} />}
                        </RoughBox>
                      </label>
                      <StrikeText id={t.id} text={t.text} done={t.done} style={strike} />
                      <button className="vd-return" onClick={() => store.unplace(t.id)} title="Return to Task List" aria-label={`Return ${t.text} to Task List`}>
                        ↩
                      </button>
                      <DeleteButton store={store} t={t} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </main>
        </section>
      </div>
      {drag && (
        <div className="vd-ghost" style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: Math.min(drag.w, 360) }} aria-hidden="true">
          {drag.text}
        </div>
      )}
    </div>
  );
}
