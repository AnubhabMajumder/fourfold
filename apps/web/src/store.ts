// The web app's copy of what the API holds, changed optimistically: the screen updates first and the change goes
// to the API in the background, in order. A change the API doesn't accept snaps back.
import { createContext, useContext, useSyncExternalStore } from 'react';
import {
  emptyMatrix,
  isBlank,
  localDate,
  newTask,
  QUADRANTS,
  RefusedError,
  refusalFor,
  refusalToMove,
  refusalToPlace,
  stateOf,
  UnreachableError,
  type CalendarDate,
  type Client,
  type Destination,
  type Matrix,
  type Quadrant,
  type Task,
} from '@fourfold/core';

export type State = {
  /** The date whose Matrix is on screen. */
  date: CalendarDate;
  taskList: Task[];
  matrix: Matrix;
  /** Whether the API has stopped answering: the page shows the "isn't running" card and takes no changes. */
  unreachable: boolean;
};

/** How often, while the API isn't answering, the app checks whether it's back. */
const RECHECK_MS = 3_000;

/** A change as the screen shows it. It must leave the state alone if it no longer applies. */
type Change = (s: State) => State;

/** The Task with `id`, wherever it is on screen: in the Task List or the Matrix. */
const findTask = (s: State, id: string) =>
  s.taskList.find((t) => t.id === id) ?? QUADRANTS.flatMap((q) => s.matrix.quadrants[q]).find((t) => t.id === id);

/** Changes the Task with `id` wherever it is on screen, leaving it in its place. */
function updateTask(s: State, id: string, update: (t: Task) => Task): State {
  const each = (list: Task[]) => list.map((t) => (t.id === id ? update(t) : t));
  const quadrants = Object.fromEntries(QUADRANTS.map((q) => [q, each(s.matrix.quadrants[q])])) as Matrix['quadrants'];
  return { ...s, taskList: each(s.taskList), matrix: { ...s.matrix, quadrants } };
}

/** The list a Task is in, or would go to: the Task List, or one of the Quadrants of the Matrix on screen. */
export type ListId = 'task-list' | Quadrant;

/** The Tasks in a list on screen. */
const listOf = (s: State, list: ListId) => (list === 'task-list' ? s.taskList : s.matrix.quadrants[list]);

/**
 * Takes the Task with `id` out of whichever list it's in on screen and puts it, changed by `as`, at `index` of `to`
 * (counted once it has left its place). Leaves the state alone if the Task isn't on screen.
 */
function putTask(s: State, id: string, to: ListId, index: number, as: (t: Task) => Task): State {
  const task = findTask(s, id);
  if (!task) return s;
  const without = (list: Task[]) => list.filter((t) => t.id !== id);
  const quadrants = Object.fromEntries(QUADRANTS.map((q) => [q, without(s.matrix.quadrants[q])])) as Matrix['quadrants'];
  const out: State = { ...s, taskList: without(s.taskList), matrix: { ...s.matrix, quadrants } };
  const list = listOf(out, to);
  const moved = [...list.slice(0, index), as(task), ...list.slice(index)];
  return to === 'task-list' ? { ...out, taskList: moved } : { ...out, matrix: { ...out.matrix, quadrants: { ...quadrants, [to]: moved } } };
}

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
  /** The next check on an API that isn't answering, if one is due. */
  private recheck: ReturnType<typeof setTimeout> | undefined;

  constructor(client: Client, today: CalendarDate = localDate(new Date())) {
    this.client = client;
    this.confirmed = this.state = { date: today, taskList: [], matrix: emptyMatrix(today), unreachable: false };
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

  /**
   * Shows a change at once and sends it; it stays on screen only if the API accepts it. While the API isn't
   * answering, the page takes no changes.
   */
  private change(change: Change, send: () => Promise<unknown>) {
    if (this.confirmed.unreachable) return;
    this.pending.push(change);
    this.show();
    this.enqueue(async () => {
      try {
        await send();
        this.confirmed = change(this.confirmed);
      } catch (err) {
        // Refused: what's on screen is out of date, so fetch what the API actually holds.
        if (err instanceof RefusedError) this.refresh();
        if (err instanceof UnreachableError) this.showNotRunning();
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

  /**
   * Fetches everything on screen: the Task List and the Matrix being viewed. Changes not yet sent stay on top of what
   * comes back. If the API doesn't answer, the "isn't running" card goes up; once it answers, the card comes down.
   */
  refresh() {
    this.enqueue(async () => {
      const date = this.confirmed.date;
      try {
        const [taskList, matrix] = await Promise.all([this.client.taskList(), this.client.matrix(date)]);
        this.confirmed = { ...this.confirmed, taskList, matrix: matrix ?? emptyMatrix(date), unreachable: false };
        clearTimeout(this.recheck);
        this.recheck = undefined;
      } catch (err) {
        // While the card is up, any failure (say, an API still starting up) means checking again later.
        if (!(err instanceof UnreachableError) && !this.confirmed.unreachable) throw err;
        this.showNotRunning();
      } finally {
        this.show();
      }
    });
  }

  /** The API has stopped answering: puts the card up, and checks every few seconds until the API is back. */
  private showNotRunning() {
    this.confirmed = { ...this.confirmed, unreachable: true };
    // Only while the card is up: otherwise Fourfold never polls the API.
    this.recheck ??= setTimeout(() => {
      this.recheck = undefined;
      this.refresh();
    }, RECHECK_MS);
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

  /**
   * Moves a Task List Task into a Quadrant of the Matrix on screen, at `position` there or at its bottom without one.
   * Returns whether the rules allow it.
   */
  place(id: string, quadrant: Quadrant, position?: number) {
    this.followToday();
    const { date, taskList } = this.state;
    const task = taskList.find((t) => t.id === id);
    if (!task || refusalToPlace(task, date, new Date())) return false;
    this.change(
      (s) =>
        s.taskList.some((x) => x.id === id) && s.matrix.date === date
          ? putTask(s, id, quadrant, position ?? s.matrix.quadrants[quadrant].length, (t) => ({ ...t, matrixDate: date, quadrant }))
          : s,
      () => this.client.place(id, date, quadrant, position),
    );
    return true;
  }

  /**
   * Changes a Task's text. Empty text deletes a Task in the Task List, and leaves a placed Task's text as it was, so
   * that a placed Task can't be deleted by clearing it.
   */
  edit(id: string, text: string) {
    const task = findTask(this.state, id);
    if (!task) return;
    if (isBlank(text)) {
      if (stateOf(task) === 'in-task-list') this.remove(id);
      return;
    }
    const trimmed = text.trim();
    this.change(
      (s) => updateTask(s, id, (t) => ({ ...t, text: trimmed })),
      () => this.client.edit(id, trimmed),
    );
  }

  /** Completes a placed Task, or un-completes a Completed one. It stays where it is. */
  setCompleted(id: string, completed: boolean) {
    const task = findTask(this.state, id);
    if (!task || refusalFor(completed ? 'complete' : 'uncomplete', task)) return;
    const completedAt = completed ? new Date().toISOString() : null;
    this.change(
      (s) => updateTask(s, id, (t) => ({ ...t, completedAt })),
      () => (completed ? this.client.complete(id) : this.client.uncomplete(id)),
    );
  }

  /** Sends an unfinished placed Task back to the Task List, at `position` there or at its top without one, leaving no trace in the Matrix. */
  returnToTaskList(id: string, position?: number) {
    const task = findTask(this.state, id);
    if (!task || refusalFor('return', task)) return;
    this.change(
      (s) =>
        s.taskList.some((x) => x.id === id)
          ? s
          : putTask(s, id, 'task-list', position ?? 0, (t) => ({ ...t, matrixDate: null, quadrant: null, completedAt: null })),
      () => this.client.return(id, position),
    );
  }

  /** Deletes a Task for good. */
  remove(id: string) {
    this.changeTaskList(
      (list) => list.filter((t) => t.id !== id),
      () => this.client.remove(id),
    );
  }

  /** Moves a Task within the list it's in, or into another Quadrant of its Matrix, so that it ends up at `index` of `to`. */
  move(id: string, to: ListId, index: number) {
    const task = findTask(this.state, id);
    const destination = this.destination(to);
    if (!task || refusalToMove(task, destination)) return;
    if (listOf(this.state, to)[index]?.id === id) return;
    const date = this.state.matrix.date;
    this.change(
      (s) => {
        const t = findTask(s, id);
        if (!t || refusalToMove(t, this.destination(to, s))) return s;
        return putTask(s, id, to, index, (x) => (to === 'task-list' ? x : { ...x, quadrant: to }));
      },
      () => this.client.move(id, to === 'task-list' ? to : { date, quadrant: to }, index),
    );
  }

  /** What dropping the Task with `id` into `to` does, at the position it's dropped at; `null` if the rules refuse it. */
  private dropping(id: string, to: ListId): ((index: number) => void) | null {
    const task = findTask(this.state, id);
    if (!task) return null;
    if (refusalToMove(task, this.destination(to)) === null) return (index) => this.move(id, to, index);
    if (to === 'task-list') return refusalFor('return', task) ? null : (index) => this.returnToTaskList(id, index);
    // Checked against the Matrix on screen, so that a Task lands where it's dropped: once midnight has passed, the
    // Matrix still showing yesterday no longer takes Placements.
    return refusalToPlace(task, this.state.matrix.date, new Date()) ? null : (index) => this.place(id, to, index);
  }

  /** Whether the rules let the Task with `id` be dropped into `to`: a target that doesn't accept isn't offered. */
  canDrop(id: string, to: ListId) {
    return this.dropping(id, to) !== null;
  }

  /** Drops the Task with `id` at `index` of `to`: a move, a Placement or a return, whichever the rules allow. */
  drop(id: string, to: ListId, index: number) {
    this.dropping(id, to)?.(index);
  }

  private destination(to: ListId, s: State = this.state): Destination {
    return to === 'task-list' ? to : { date: s.matrix.date, quadrant: to };
  }
}

export const StoreContext = createContext<Store | null>(null);

export function useStore() {
  const store = useContext(StoreContext)!;
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return [state, store] as const;
}
