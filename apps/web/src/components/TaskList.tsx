import { useState } from 'react';
import { SEEDS } from '../sketch/geometry.ts';
import { SketchBox } from '../sketch/Sketch.tsx';
import { useStore } from '../store.ts';

export function TaskList() {
  const [state, store] = useStore();
  const [text, setText] = useState('');
  return (
    <aside className="task-list" aria-labelledby="task-list-heading">
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
        {state.taskList.map((t) => (
          <li key={t.id} className="task-row">
            {t.text}
          </li>
        ))}
      </ul>
    </aside>
  );
}
