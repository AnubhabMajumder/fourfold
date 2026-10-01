import { useLayoutEffect, useRef, useState } from 'react';
import { Strike } from '../sketch/Sketch.tsx';

/**
 * A Task's text, edited in place: double-click (or double-tap) turns it into an input; Enter or clicking away saves,
 * Esc cancels. What empty text means is up to `onSave`. A placed Task's text is struck through while `strike.done`.
 */
export function TaskText({
  id,
  text,
  strike,
  onSave,
}: {
  /** The id of the text's element, for whatever it labels. */
  id?: string;
  text: string;
  strike?: { seed: number; done: boolean; drawOn: boolean };
  onSave: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (!editing)
    return (
      <span id={id} className="task-text" onDoubleClick={() => setEditing(true)}>
        {strike ? (
          <Strike seed={strike.seed} done={strike.done} drawOn={strike.drawOn}>
            {text}
          </Strike>
        ) : (
          text
        )}
      </span>
    );
  return (
    <TextInput
      text={text}
      onDone={(edited) => {
        setEditing(false);
        if (edited !== null && edited.trim() !== text) onSave(edited);
      }}
    />
  );
}

function TextInput({ text, onDone }: { text: string; onDone: (edited: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  // Enter and Esc end the edit before the input's blur does, so it must end only once.
  const done = useRef(false);
  const finish = (edited: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(edited);
  };
  useLayoutEffect(() => {
    const input = ref.current!;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, []);
  return (
    <input
      ref={ref}
      className="task-text"
      defaultValue={text}
      aria-label="Task text"
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter') finish(e.currentTarget.value);
        if (e.key === 'Escape') finish(null);
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
    />
  );
}
