// The web app's copy of what the API holds, changed optimistically: the screen updates first and the change goes
// to the API in the background, in order. A change the API doesn't accept snaps back.
import { createContext, useContext, useSyncExternalStore } from 'react';
import { isBlank, newTask, RefusedError, type Client, type Task } from '@fourfold/core';

export type State = {
  taskList: Task[];
};

/** A change to the Task List, applied to whatever the Task List is at the time. */
type Change = (taskList: Task[]) => Task[];

export class Store {
  private state: State = { taskList: [] };
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  /** The Task List as the API holds it, as far as we know. */
  private confirmed: Task[] = [];
  /** Changes on screen that the API hasn't accepted yet, oldest first. */
  private pending = new Set<Change>();
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getState = () => this.state;

  /** Shows what the API holds with every pending change on top. */
  private show() {
    this.state = { ...this.state, taskList: [...this.pending].reduce((list, change) => change(list), this.confirmed) };
    for (const l of this.listeners) l();
  }

  private enqueue(job: () => Promise<void>) {
    this.queue = this.queue.then(job).catch(() => {});
  }

  /** Shows a change at once and sends it; if it isn't accepted, it disappears from the screen again. */
  private change(apply: Change, send: () => Promise<unknown>) {
    this.pending.add(apply);
    this.show();
    this.enqueue(async () => {
      try {
        await send();
        this.confirmed = apply(this.confirmed);
      } catch (err) {
        // Refused: what's on screen is out of date, so fetch what the API actually holds.
        if (err instanceof RefusedError) this.refresh();
      } finally {
        this.pending.delete(apply);
        this.show();
      }
    });
  }

  /** Fetches the Task List, keeping on screen the changes that haven't been sent yet. */
  refresh() {
    this.enqueue(async () => {
      this.confirmed = await this.client.taskList();
      this.show();
    });
  }

  /** Adds a Task to the top of the Task List at once, and sends it. Returns whether it was added. */
  write(text: string) {
    if (isBlank(text)) return false;
    // The web app creates the id, so the Task on screen is already the one the API will keep.
    const task = newTask(crypto.randomUUID(), text.trim(), new Date().toISOString());
    this.change(
      (list) => (list.some((t) => t.id === task.id) ? list : [task, ...list]),
      () => this.client.write(task.id, task.text),
    );
    return true;
  }

  /** Changes a Task's text; empty text deletes it. */
  edit(id: string, text: string) {
    if (isBlank(text)) return this.remove(id);
    const trimmed = text.trim();
    this.change(
      (list) => list.map((t) => (t.id === id ? { ...t, text: trimmed } : t)),
      () => this.client.edit(id, trimmed),
    );
  }

  /** Deletes a Task for good. */
  remove(id: string) {
    this.change(
      (list) => list.filter((t) => t.id !== id),
      () => this.client.remove(id),
    );
  }

  /** Moves a Task within the Task List, so that it ends up at `index`. */
  move(id: string, index: number) {
    const from = this.state.taskList.findIndex((t) => t.id === id);
    if (from < 0 || from === index) return;
    this.change(
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
