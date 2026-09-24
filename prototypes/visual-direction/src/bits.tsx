// PROTOTYPE: tiny unstyled pieces the variants share. Each variant styles them itself.
import { useState, type ReactNode } from 'react';
import { QUADRANTS, type QuadrantIndex, type Store, type Task } from './store';

export function AddTask({ store, placeholder, button }: { store: Store; placeholder: string; button: ReactNode }) {
  const [text, setText] = useState('');
  return (
    <form
      className="add-task"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) store.add(text.trim());
        setText('');
      }}
    >
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="New Task" />
      <button type="submit">{button}</button>
    </form>
  );
}

const SHORT = ['I·U', 'I·NU', 'NI·U', 'NI·NU'];

/** Placement stand-in: real positional placement (drag/keyboard) is a later ticket. */
export function PlaceButtons({ store, task, render }: { store: Store; task: Task; render?: (q: number) => ReactNode }) {
  return (
    <span className="place-buttons">
      {QUADRANTS.map((q, i) => (
        <button key={i} title={`Place into ${q.label}`} aria-label={`Place into ${q.label}`} onClick={() => store.place(task.id, i as QuadrantIndex)}>
          {render ? render(i) : SHORT[i]}
        </button>
      ))}
    </span>
  );
}

export const DATE = 'Thursday, 24 September';
