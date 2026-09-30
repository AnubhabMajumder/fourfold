// The web app's copy of what the API holds, changed optimistically: the screen updates first and the change goes
// to the API in the background, in order. A change the API doesn't accept snaps back.
import { createContext, useContext, useSyncExternalStore } from 'react';
import { isBlank, RefusedError, type Client, type Task } from '@fourfold/core';

export type State = {
  taskList: Task[];
};

export class Store {
  private state: State = { taskList: [] };
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  /** Tasks on screen whose write hasn't reached the API yet, oldest first. */
  private unsent = new Map<string, Task>();
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getState = () => this.state;

  private set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  private enqueue(job: () => Promise<void>) {
    this.queue = this.queue.then(job).catch(() => {});
  }

  /** Fetches the Task List, replacing what's on screen except Tasks written since that haven't been sent yet. */
  refresh() {
    this.enqueue(async () => {
      const taskList = await this.client.taskList();
      const unsent = [...this.unsent.values()].reverse().filter((t) => !taskList.some((s) => s.id === t.id));
      this.set({ taskList: [...unsent, ...taskList] });
    });
  }

  /** Adds a Task to the top of the Task List at once, and sends it. Returns whether it was added. */
  write(text: string) {
    if (isBlank(text)) return false;
    // The web app creates the id, so the Task on screen is already the one the API will keep.
    const task: Task = { id: crypto.randomUUID(), text: text.trim(), createdAt: new Date().toISOString(), matrixDate: null, quadrant: null, completedAt: null };
    this.set({ taskList: [task, ...this.state.taskList] });
    this.unsent.set(task.id, task);
    this.enqueue(async () => {
      try {
        await this.client.write(task.id, task.text);
      } catch (err) {
        this.set({ taskList: this.state.taskList.filter((t) => t.id !== task.id) });
        // Refused: what's on screen is out of date, so fetch what the API actually holds.
        if (err instanceof RefusedError) this.refresh();
      } finally {
        this.unsent.delete(task.id);
      }
    });
    return true;
  }
}

export const StoreContext = createContext<Store | null>(null);

export function useStore() {
  const store = useContext(StoreContext)!;
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return [state, store] as const;
}
