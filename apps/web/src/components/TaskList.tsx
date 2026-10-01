import { useLayoutEffect, useRef, useState } from 'react';
import type { Quadrant, Task } from '@fourfold/core';
import { DropList, useDraggable } from '../drag/drag.tsx';
import { SEEDS, seedOf } from '../sketch/geometry.ts';
import { DeleteMark, SketchBox } from '../sketch/Sketch.tsx';
import { useStore } from '../store.ts';
import { PlaceButtons } from './PlaceButtons.tsx';
import { TaskText } from './TaskText.tsx';

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
      <DropList id="task-list" accepts={(id) => store.canDrop(id, 'task-list')} onDrop={(id, index) => store.drop(id, 'task-list', index)}>
        <ul>
          {state.taskList.map((t, i) => (
            <TaskRow
              key={t.id}
              task={t}
              onPlace={(q) => {
                if (store.place(t.id, q)) setFocusRow(i);
              }}
            />
          ))}
        </ul>
      </DropList>
    </aside>
  );
}

function TaskRow({ task, onPlace }: { task: Task; onPlace: (quadrant: Quadrant) => void }) {
  const [, store] = useStore();
  const { isDragging, props } = useDraggable(task.id, task.text);
  return (
    <li className={`task-row${isDragging ? ' is-dragged' : ''}`} {...props}>
      {/* Empty text deletes a Task in the Task List. */}
      <TaskText text={task.text} onSave={(text) => store.edit(task.id, text)} />
      <PlaceButtons task={task} onPlace={onPlace} />
      <button type="button" className="delete" aria-label="Delete" onClick={() => store.remove(task.id)}>
        <DeleteMark seed={seedOf(task.id)} />
      </button>
    </li>
  );
}
