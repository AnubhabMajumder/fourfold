import { useState } from 'react';
import { formatDate, QUADRANT_NAMES, QUADRANTS, stateOf, type Task } from '@fourfold/core';
import { DropList, useDraggable } from '../drag/drag.tsx';
import { SettingsGear } from '../settings/Settings.tsx';
import { SEEDS, seedOf } from '../sketch/geometry.ts';
import { CheckboxMark, Dividers, Hatching, MiniList } from '../sketch/Sketch.tsx';
import { useStore } from '../store.ts';
import { TaskText } from './TaskText.tsx';

/** The Matrix on screen: four Quadrants, left to right and top to bottom in QUADRANTS order. */
export function Matrix() {
  const [{ matrix }, store] = useStore();
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
        {QUADRANTS.map((q, i) => {
          const tasks = matrix.quadrants[q];
          const allCompleted = tasks.length > 0 && tasks.every((t) => stateOf(t) === 'completed');
          return (
            <section key={q} className="quadrant" aria-label={QUADRANT_NAMES[q]}>
              {allCompleted && <Hatching seed={SEEDS.hatching + i} />}
              <DropList id={q} accepts={(id) => store.canDrop(id, q)} onDrop={(id, index) => store.drop(id, q, index)}>
                <ul>
                  {tasks.map((t) => (
                    <PlacedTask key={t.id} task={t} />
                  ))}
                </ul>
              </DropList>
            </section>
          );
        })}
      </div>
      <SettingsGear />
    </section>
  );
}

/** A placed Task: a checkbox labelled by its text, the text, and (unless Completed) the button that returns it. */
function PlacedTask({ task }: { task: Task }) {
  const [, store] = useStore();
  const seed = seedOf(task.id);
  const textId = `text-${task.id}`;
  const completed = stateOf(task) === 'completed';
  // Whether the user last ticked (rather than unticked) the checkbox: only that draws the strike on.
  const [ticked, setTicked] = useState(false);
  const { isDragging, props } = useDraggable(task.id, task.text);
  return (
    <li className={`placed-task${isDragging ? ' is-dragged' : ''}`} {...props}>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={completed}
          aria-labelledby={textId}
          onChange={(e) => {
            setTicked(e.currentTarget.checked);
            store.setCompleted(task.id, e.currentTarget.checked);
          }}
        />
        <CheckboxMark seed={seed} checked={completed} />
      </label>
      {/* Empty text leaves a placed Task's text as it was. */}
      <TaskText id={textId} text={task.text} strike={{ seed, done: completed, drawOn: ticked }} onSave={(text) => store.edit(task.id, text)} />
      {!completed && (
        <button type="button" className="icon-button return" aria-label="Return to the Task List" onClick={() => store.returnToTaskList(task.id)}>
          <MiniList seed={seed + 7} />
        </button>
      )}
    </li>
  );
}
