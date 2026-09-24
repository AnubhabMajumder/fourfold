// PROTOTYPE variant A: hand-drawn is confined to the Matrix's lines, Quadrant labels and the strike.
// Everything else, Task text included, is a plain, clean sans UI.
import { AddTask, DATE, PlaceButtons } from '../bits';
import { Dividers, StrikeText } from '../draw';
import { QUADRANTS, type QuadrantIndex, type VariantProps } from '../store';

export const name = 'Matrix only';

export function Variant({ store, strike }: VariantProps) {
  return (
    <div className="va">
      <header className="va-top">
        <span className="va-logo">Fourfold</span>
        <nav className="va-date">
          <button aria-label="Previous date">‹</button>
          <span>{DATE}</span>
          <button aria-label="Next date">›</button>
        </nav>
        <span className="va-pill">Current Matrix</span>
      </header>
      <div className="va-body">
        <aside className="va-list">
          <h2>Task List</h2>
          <AddTask store={store} placeholder="Write a Task…" button="Add" />
          <ul>
            {store.list.map((t) => (
              <li key={t.id}>
                <span>{t.text}</span>
                <PlaceButtons store={store} task={t} />
              </li>
            ))}
          </ul>
        </aside>
        <main className="va-matrix">
          <Dividers kind="pencil" />
          {QUADRANTS.map((q, i) => (
            <section key={i} className="va-q" aria-labelledby={`va-q${i}`}>
              <h3 id={`va-q${i}`}>{q.label}</h3>
              <ul>
                {store.inQuadrant(i as QuadrantIndex).map((t) => (
                  <li key={t.id}>
                    <input type="checkbox" checked={t.done} onChange={() => store.toggle(t.id)} aria-label={`Completed: ${t.text}`} />
                    <StrikeText id={t.id} text={t.text} done={t.done} style={strike} />
                    <button className="va-return" onClick={() => store.unplace(t.id)} title="Return to Task List">
                      ↩
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
