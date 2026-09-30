import { formatDate, QUADRANT_NAMES, QUADRANTS } from '@fourfold/core';
import { SEEDS } from '../sketch/geometry.ts';
import { Dividers } from '../sketch/Sketch.tsx';
import { useStore } from '../store.ts';

/** The Matrix on screen: four Quadrants, left to right and top to bottom in QUADRANTS order. */
export function Matrix() {
  const [{ matrix }] = useStore();
  return (
    <section className="matrix" aria-label={`Matrix for ${formatDate(matrix.date)}`}>
      {/* The axis headers say visually what each Quadrant's label says to a screen reader. */}
      <div className="axis axis-top" aria-hidden="true">
        <span>urgent</span>
        <span>not urgent</span>
      </div>
      <div className="axis axis-left" aria-hidden="true">
        <span>important</span>
        <span>not important</span>
      </div>
      <div className="quadrants">
        <Dividers seed={SEEDS.dividers} />
        {QUADRANTS.map((q) => (
          <section key={q} className="quadrant" aria-label={QUADRANT_NAMES[q]}>
            <ul>
              {matrix.quadrants[q].map((t) => (
                <li key={t.id} className="placed-task">
                  {t.text}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
