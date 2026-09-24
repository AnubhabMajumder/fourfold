// PROTOTYPE variant B: the Matrix is a handwritten page (ink dividers, handwriting for labels AND Task text),
// framed by plain app chrome. The Task List is a tray of chips above the Matrix; tapping a Task completes it.
import { AddTask, DATE, PlaceButtons } from '../bits';
import { Dividers, StrikeText } from '../draw';
import { QUADRANTS, type QuadrantIndex, type VariantProps } from '../store';

export const name = 'Ink Matrix, plain chrome';

export function Variant({ store, strike }: VariantProps) {
  return (
    <div className="vb">
      <header className="vb-top">
        <div>
          <div className="vb-eyebrow">Current Matrix</div>
          <h1>{DATE}</h1>
        </div>
        <AddTask store={store} placeholder="Add to Task List" button="+" />
      </header>
      <div className="vb-tray" aria-label="Task List">
        <span className="vb-tray-label">Task List · {store.list.length}</span>
        {store.list.map((t) => (
          <span key={t.id} className="vb-chip">
            {t.text}
            <PlaceButtons store={store} task={t} render={(q) => <span className={`vb-dot vb-dot${q}`} />} />
          </span>
        ))}
      </div>
      <div className="vb-stage">
        <div className="vb-axis-top" aria-hidden="true">
          <span>urgent</span>
          <span>not urgent</span>
        </div>
        <div className="vb-axis-left" aria-hidden="true">
          <span>important</span>
          <span>not important</span>
        </div>
        <main className="vb-matrix">
          <Dividers kind="ink" />
          {QUADRANTS.map((q, i) => (
            <section key={i} className="vb-q" aria-label={q.label}>
              <ol>
                {store.inQuadrant(i as QuadrantIndex).map((t) => (
                  <li key={t.id}>
                    <button role="checkbox" aria-checked={t.done} className="vb-task" onClick={() => store.toggle(t.id)}>
                      <StrikeText id={t.id} text={t.text} done={t.done} style={strike} />
                    </button>
                    <button className="vb-return" onClick={() => store.unplace(t.id)} title="Return to Task List">
                      ↩
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
