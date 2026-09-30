// The web app's copy of what the API holds, changed optimistically: the screen updates first and the change goes
// to the API in the background, in order. A change the API doesn't accept snaps back.
import { createContext, useContext, useSyncExternalStore } from 'react';
import {
  emptyMatrix,
  isBlank,
  localDate,
  newTask,
  RefusedError,
  refusalToPlace,
  type CalendarDate,
  type Client,
  type Matrix,
  type Quadrant,
  type Task,
} from '@fourfold/core';

export type State = {
  /** The date whose Matrix is on screen. */
  date: CalendarDate;
  taskList: Task[];
  matrix: Matrix;
};

/** A change as the screen shows it. It must leave the state alone if it no longer applies. */
type Change = (s: State) => State;

export class Store {
  /** What the API has said it holds. */
  private confirmed: State;
  /** Changes on screen that the API hasn't accepted yet, oldest first. */
  private pending: Change[] = [];
  /** What's on screen: the pending changes over what the API holds. */
  private state: State;
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  private readonly client: Client;

  constructor(client: Client, today: CalendarDate = localDate(new Date())) {
    this.client = client;
    this.confirmed = this.state = { date: today, taskList: [], matrix: emptyMatrix(today) };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getState = () => this.state;

  private show() {
    this.state = this.pending.reduce((s, change) => change(s), this.confirmed);
    for (const l of this.listeners) l();
  }

  private enqueue(job: () => Promise<void>) {
    this.queue = this.queue.then(job).catch(() => {});
  }

  /** Shows a change at once and sends it; it stays on screen only if the API accepts it. */
  private change(change: Change, send: () => Promise<unknown>) {
    this.pending.push(change);
    this.show();
    this.enqueue(async () => {
      try {
        await send();
        this.confirmed = change(this.confirmed);
      } catch (err) {
        // Refused: what's on screen is out of date, so fetch what the API actually holds.
        if (err instanceof RefusedError) this.refresh();
      } finally {
        this.pending.splice(this.pending.indexOf(change), 1);
        this.show();
      }
    });
  }

  /** A change to the Task List alone, applied to whatever the Task List is at the time. */
  private changeTaskList(apply: (taskList: Task[]) => Task[], send: () => Promise<unknown>) {
    this.change((s) => ({ ...s, taskList: apply(s.taskList) }), send);
  }

  /** Fetches the Task List and the Matrix on screen; changes not yet sent stay on top of what comes back. */
  refresh() {
    this.enqueue(async () => {
      const date = this.confirmed.date;
      const [taskList, matrix] = await Promise.all([this.client.taskList(), this.client.matrix(date)]);
      this.confirmed = { ...this.confirmed, taskList, matrix: matrix ?? emptyMatrix(date) };
      this.show();
    });
  }

  /** Adds a Task to the top of the Task List at once, and sends it. Returns whether it was added. */
  write(text: string) {
    if (isBlank(text)) return false;
    // The web app creates the id, so the Task on screen is already the one the API will keep.
    const task = newTask(crypto.randomUUID(), text.trim(), new Date().toISOString());
    this.change(
      (s) => (s.taskList.some((t) => t.id === task.id) ? s : { ...s, taskList: [task, ...s.taskList] }),
      () => this.client.write(task.id, task.text),
    );
    return true;
  }

  /** The app shows today, so once midnight has passed it moves on to the new day's Matrix. */
  private followToday() {
    const today = localDate(new Date());
    if (this.confirmed.date === today) return;
    this.confirmed = { ...this.confirmed, date: today, matrix: emptyMatrix(today) };
    this.show();
    this.refresh();
  }

  /** Moves a Task List Task to the bottom of a Quadrant of the Matrix on screen. Returns whether the rules allow it. */
  place(id: string, quadrant: Quadrant) {
    this.followToday();
    const { date, taskList } = this.state;
    const task = taskList.find((t) => t.id === id);
    if (!task || refusalToPlace(task, date, new Date())) return false;
    this.change(
      (s) => {
        const t = s.taskList.find((x) => x.id === id);
        if (!t || s.matrix.date !== date) return s;
        const quadrants = { ...s.matrix.quadrants, [quadrant]: [...s.matrix.quadrants[quadrant], { ...t, matrixDate: date, quadrant }] };
        return { ...s, taskList: s.taskList.filter((x) => x.id !== id), matrix: { ...s.matrix, quadrants } };
      },
      () => this.client.place(id, date, quadrant),
    );
    return true;
  }

  /** Changes a Task's text; empty text deletes it. */
  edit(id: string, text: string) {
    if (isBlank(text)) return this.remove(id);
    const trimmed = text.trim();
    this.changeTaskList(
      (list) => list.map((t) => (t.id === id ? { ...t, text: trimmed } : t)),
      () => this.client.edit(id, trimmed),
    );
  }

  /** Deletes a Task for good. */
  remove(id: string) {
    this.changeTaskList(
      (list) => list.filter((t) => t.id !== id),
      () => this.client.remove(id),
    );
  }

  /** Moves a Task within the Task List, so that it ends up at `index`. */
  move(id: string, index: number) {
    const from = this.state.taskList.findIndex((t) => t.id === id);
    if (from < 0 || from === index) return;
    this.changeTaskList(
      (list) => {
        const task = list.find((t) => t.id === id);
        if (!task) return list;
        const rest = list.filter((t) => t !== task);
        return [...rest.slice(0, index), task, ...rest.slice(index)];
      },
      () => this.client.move(id, index),
    );
  }
}

export const StoreContext = createContext<Store | null>(null);

export function useStore() {
  const store = useContext(StoreContext)!;
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return [state, store] as const;
}
