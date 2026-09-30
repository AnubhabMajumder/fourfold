// PROTOTYPE: in-memory Tasks only. Array order = order within a Quadrant (#6).
import { useState } from 'react';

export type QuadrantIndex = 0 | 1 | 2 | 3;
export type Task = { id: string; text: string; quadrant: QuadrantIndex | null; done: boolean };

export const QUADRANTS = [
  { label: 'Important · Urgent', important: true, urgent: true },
  { label: 'Important · Not urgent', important: true, urgent: false },
  { label: 'Not important · Urgent', important: false, urgent: true },
  { label: 'Not important · Not urgent', important: false, urgent: false },
] as const;

const SEED: Task[] = [
  { id: 't1', text: 'Call the landlord about the leaking tap', quadrant: null, done: false },
  { id: 't2', text: 'Book a dentist appointment', quadrant: null, done: false },
  { id: 't3', text: 'Read chapter 4 of the distributed systems book', quadrant: null, done: false },
  { id: 't4', text: 'Submit tax return (due tonight)', quadrant: 0, done: true },
  { id: 't5', text: 'Fix the login bug before the demo', quadrant: 0, done: false },
  { id: 't6', text: 'Pick up medicine from the pharmacy', quadrant: 0, done: true },
  { id: 't7', text: 'Plan next month’s budget', quadrant: 1, done: false },
  {
    id: 't8',
    text: 'Sketch the onboarding flow: the part where a new user writes their first few Tasks and places them into the Matrix',
    quadrant: 1,
    done: true,
  },
  { id: 't9', text: '30 min run', quadrant: 1, done: false },
  { id: 't10', text: 'Return the library books', quadrant: 2, done: false },
  { id: 't11', text: 'Answer the courier', quadrant: 2, done: true },
  { id: 't12', text: 'Reorganise the bookshelf', quadrant: 3, done: false },
  { id: 't13', text: 'Watch that documentary', quadrant: 3, done: false },
];

let nextId = 100;

export function useTasks() {
  const [tasks, setTasks] = useState(SEED);
  const moveToEnd = (id: string, patch: Partial<Task>) =>
    setTasks((ts) => {
      const t = ts.find((x) => x.id === id)!;
      return [...ts.filter((x) => x.id !== id), { ...t, ...patch }];
    });
  return {
    tasks,
    list: tasks.filter((t) => t.quadrant === null),
    inQuadrant: (q: QuadrantIndex) => tasks.filter((t) => t.quadrant === q),
    toggle: (id: string) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
    place: (id: string, q: QuadrantIndex) => moveToEnd(id, { quadrant: q }),
    unplace: (id: string) => moveToEnd(id, { quadrant: null, done: false }),
    /** Drop a Task into a Quadrant (or back to the Task List, q = null) before the index-th Task already there. */
    move: (id: string, q: QuadrantIndex | null, index: number) =>
      setTasks((ts) => {
        const t = ts.find((x) => x.id === id)!;
        const rest = ts.filter((x) => x.id !== id);
        const moved = { ...t, quadrant: q, done: q === null ? false : t.done };
        const zone = rest.filter((x) => x.quadrant === q);
        if (index >= zone.length) return [...rest, moved];
        const at = rest.indexOf(zone[index]);
        return [...rest.slice(0, at), moved, ...rest.slice(at)];
      }),
    remove: (id: string) => setTasks((ts) => ts.filter((t) => t.id !== id)),
    /** PROTOTYPE (#27): snap everything back to an earlier snapshot, as the web app does when a change can't reach the API. */
    replaceAll: setTasks,
    add: (text: string) => setTasks((ts) => [...ts, { id: `n${nextId++}`, text, quadrant: null, done: false }]),
  };
}

export type Store = ReturnType<typeof useTasks>;
export type StrikeStyle = 'zigzag' | 'rough';
export const STRIKES: StrikeStyle[] = ['zigzag', 'rough'];
export type VariantProps = {
  store: Store;
  strike: StrikeStyle;
  /** PROTOTYPE (#27): slots for showing that the API can't be reached. */
  headerNote?: import('react').ReactNode;
  belowHeader?: import('react').ReactNode;
  overlay?: import('react').ReactNode;
  paused?: boolean;
};
