// PROTOTYPE variant C: the whole app is a notebook. Paper, ruled Task List page, sketchy buttons,
// inputs and checkboxes, pencil axes with arrows, handwriting everywhere.
import { AddTask, DATE, PlaceButtons } from '../bits';
import { Dividers, RoughBox, RoughCheck, StrikeText } from '../draw';
import { seedOf } from '../sketch';
import { QUADRANTS, type QuadrantIndex, type VariantProps } from '../store';

export const name = 'Whole notebook';

export function Variant({ store, strike }: VariantProps) {
  return (
    <div className="vc">
      <svg className="vc-grain" aria-hidden="true">
        <filter id="vc-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
          <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0.09 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#vc-grain)" />
      </svg>
      <header className="vc-top">
        <h1>Fourfold</h1>
        <nav className="vc-date">
          <RoughBox seed={11} className="vc-btn">
            <button aria-label="Previous date">‹</button>
          </RoughBox>
          <span>{DATE}</span>
          <RoughBox seed={12} className="vc-btn">
            <button aria-label="Next date">›</button>
          </RoughBox>
        </nav>
      </header>
      <div className="vc-spread">
        <section className="vc-page vc-listpage" aria-labelledby="vc-list">
          <h2 id="vc-list">Task List</h2>
          <RoughBox seed={21} className="vc-add">
            <AddTask store={store} placeholder="write a Task…" button="add" />
          </RoughBox>
          <ul>
            {store.list.map((t) => (
              <li key={t.id}>
                <span>{t.text}</span>
                <PlaceButtons
                  store={store}
                  task={t}
                  render={(q) => (
                    <RoughBox seed={seedOf(t.id) + q} className="vc-mini">
                      {q + 1}
                    </RoughBox>
                  )}
                />
              </li>
            ))}
          </ul>
        </section>
        <section className="vc-page vc-matrixpage" aria-label={`Matrix for ${DATE}`}>
          <div className="vc-axis vc-axis-imp" aria-hidden="true">more important</div>
          <div className="vc-axis vc-axis-urg" aria-hidden="true">more urgent</div>
          <main className="vc-matrix">
            <Dividers kind="pencil-arrows" seed={31} />
            {QUADRANTS.map((q, i) => (
              <section key={i} className="vc-q" aria-labelledby={`vc-q${i}`}>
                <h3 id={`vc-q${i}`}>{q.label}</h3>
                <ul>
                  {store.inQuadrant(i as QuadrantIndex).map((t) => (
                    <li key={t.id}>
                      <label className="vc-check">
                        <input type="checkbox" className="sr-only" checked={t.done} onChange={() => store.toggle(t.id)} aria-label={`Completed: ${t.text}`} />
                        <RoughBox seed={seedOf(t.id)} className="vc-box">
                          {t.done && <RoughCheck seed={seedOf(t.id) + 5} />}
                        </RoughBox>
                      </label>
                      <StrikeText id={t.id} text={t.text} done={t.done} style={strike} />
                      <button className="vc-return" onClick={() => store.unplace(t.id)} title="Return to Task List">
                        ↩
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </main>
        </section>
      </div>
    </div>
  );
}
