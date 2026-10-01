import { formatDate, type CalendarDate } from '@fourfold/core';
import { SEEDS } from '../sketch/geometry.ts';
import { SketchBox } from '../sketch/Sketch.tsx';
import { useStore } from '../store.ts';

/** "Fourfold", and the date on screen between ‹ and ›; past the oldest Matrix, no date is on screen. */
export function Header({ date }: { date: CalendarDate }) {
  const [state, store] = useStore();
  return (
    <header className="header">
      <h1>Fourfold</h1>
      <nav className="date-nav" aria-label="Dates">
        <SketchBox seed={SEEDS.previousDate}>
          <button type="button" aria-label="Previous date" disabled={store.previous(state) === null} onClick={() => store.goBack()}>
            ‹
          </button>
        </SketchBox>
        <span className="date">{state.noEarlier ? '' : formatDate(date)}</span>
        <SketchBox seed={SEEDS.nextDate}>
          <button type="button" aria-label="Next date" disabled={store.next(state) === null} onClick={() => store.goForward()}>
            ›
          </button>
        </SketchBox>
      </nav>
    </header>
  );
}
