import { useLayoutEffect, useRef, useState } from 'react';
import { SEEDS } from '../sketch/geometry.ts';
import { SketchBox } from '../sketch/Sketch.tsx';
import { useStore } from '../store.ts';
import { PlaceButtons } from './PlaceButtons.tsx';

export function TaskList() {
  const [state, store] = useStore();
  const [text, setText] = useState('');
  const aside = useRef<HTMLElement>(null);
  /** After a Placement, the row whose mini-Matrix button takes the focus the placed Task's buttons had. */
  const [focusRow, setFocusRow] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (focusRow === null) return;
    setFocusRow(null);
    const toggles = aside.current!.querySelectorAll<HTMLElement>('.task-row .place > button');
    (toggles[Math.min(focusRow, toggles.length - 1)] ?? aside.current!.querySelector('input'))?.focus();
  }, [focusRow]);

  return (
    <aside ref={aside} className="task-list" aria-labelledby="task-list-heading">
      <h2 id="task-list-heading">Task List</h2>
      <form
        className="add-task"
        onSubmit={(e) => {
          e.preventDefault();
          if (store.write(text)) setText('');
        }}
      >
        <SketchBox seed={SEEDS.input} className="new-task">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a Task…" aria-label="New Task" autoFocus />
        </SketchBox>
        <SketchBox seed={SEEDS.add}>
          <button type="submit">add</button>
        </SketchBox>
      </form>
      <ul>
        {state.taskList.map((t, i) => (
          <li key={t.id} className="task-row">
            <span className="task-text">{t.text}</span>
            <PlaceButtons
              task={t}
              onPlace={(q) => {
                if (store.place(t.id, q)) setFocusRow(i);
              }}
            />
          </li>
        ))}
      </ul>
    </aside>
  );
}
