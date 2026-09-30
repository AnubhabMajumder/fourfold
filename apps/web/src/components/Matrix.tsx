import { formatDate, QUADRANTS, type CalendarDate, type Quadrant } from '@fourfold/core';
import { SEEDS } from '../sketch/geometry.ts';
import { Dividers } from '../sketch/Sketch.tsx';

const LABELS: Record<Quadrant, string> = {
  'important-urgent': 'Important + Urgent',
  'important-not-urgent': 'Important + Not Urgent',
  'not-important-urgent': 'Not Important + Urgent',
  'not-important-not-urgent': 'Not Important + Not Urgent',
};

/** A date's Matrix: four Quadrants, left to right and top to bottom in QUADRANTS order. */
export function Matrix({ date }: { date: CalendarDate }) {
  return (
    <section className="matrix" aria-label={`Matrix for ${formatDate(date)}`}>
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
          <section key={q} className="quadrant" aria-label={LABELS[q]}>
            <ul />
          </section>
        ))}
      </div>
    </section>
  );
}
