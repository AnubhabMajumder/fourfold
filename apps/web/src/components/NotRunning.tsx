import { useEffect, useRef } from 'react';
import { SEEDS } from '../sketch/geometry.ts';
import { SketchBox } from '../sketch/Sketch.tsx';

/**
 * The card over the dimmed page while the API isn't answering. It can't be dismissed: it goes by itself once the API
 * answers again and everything has been re-fetched.
 */
export function NotRunning() {
  const ref = useRef<HTMLDivElement>(null);
  // Takes the focus from the page behind, which takes no changes now, so that a screen reader announces the card.
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="not-running">
      <SketchBox seed={SEEDS.notRunning} className="not-running-card">
        <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="not-running-title" aria-describedby="not-running-text" tabIndex={-1}>
          <h2 id="not-running-title">Fourfold isn’t running</h2>
          <div id="not-running-text">
            <p>Start it with the Start Fourfold shortcut.</p>
            <p className="faint">This page will catch up by itself.</p>
          </div>
        </div>
      </SketchBox>
    </div>
  );
}
