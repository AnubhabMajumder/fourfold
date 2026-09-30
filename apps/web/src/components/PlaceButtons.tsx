import { useEffect, useRef, useState } from 'react';
import { QUADRANT_NAMES, QUADRANTS, type Quadrant, type Task } from '@fourfold/core';
import { seedOf } from '../sketch/geometry.ts';
import { MiniMatrix } from '../sketch/Sketch.tsx';

/**
 * Placing without dragging: a mini-Matrix icon that opens four Quadrant buttons, each a mini-Matrix with its
 * Quadrant marked. Escape or moving focus away closes them.
 */
export function PlaceButtons({ task, onPlace }: { task: Task; onPlace: (quadrant: Quadrant) => void }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const seed = seedOf(task.id);
  const groupId = `place-${task.id}`;

  useEffect(() => {
    if (open) group.current?.querySelector('button')?.focus();
  }, [open]);

  return (
    <div
      className="place"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={toggle}
        type="button"
        className="icon-button"
        aria-label="Place in the Matrix"
        aria-expanded={open}
        aria-controls={open ? groupId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <MiniMatrix seed={seed} />
      </button>
      {open && (
        <div ref={group} id={groupId} role="group" aria-label="Quadrants" className="place-quadrants">
          {QUADRANTS.map((q, i) => (
            <button key={q} type="button" className="icon-button" aria-label={`Place in ${QUADRANT_NAMES[q]}`} onClick={() => onPlace(q)}>
              <MiniMatrix seed={seed + 10 * (i + 1)} marked={i} size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
