import { formatDate, type CalendarDate } from '@fourfold/core';
import { SEEDS } from '../sketch/geometry.ts';
import { SketchBox } from '../sketch/Sketch.tsx';

export function Header({ date }: { date: CalendarDate }) {
  return (
    <header className="header">
      <h1>Fourfold</h1>
      <nav className="date-nav" aria-label="Dates">
        <SketchBox seed={SEEDS.previousDate}>
          <button type="button" aria-label="Previous date">
            ‹
          </button>
        </SketchBox>
        <span className="date">{formatDate(date)}</span>
        <SketchBox seed={SEEDS.nextDate}>
          <button type="button" aria-label="Next date">
            ›
          </button>
        </SketchBox>
      </nav>
    </header>
  );
}
