// The web app's copy of what the API holds, changed optimistically: the screen updates first and the change goes
// to the API in the background, in order. A change the API doesn't accept snaps back.
import { createContext, useContext, useSyncExternalStore } from 'react';
import {
  emptyMatrix,
  isBlank,
  isFrozen,
  latestPlaceableDate,
  localDate,
  newTask,
  nextDate,
  previousDate,
  QUADRANTS,
  RefusedError,
  refusalFor,
  refusalToMove,
  refusalToPlace,
  stateOf,
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
  /** Whether ‹ has gone past the oldest Matrix: the Matrix area shows "No earlier Matrix", and › returns to `date`. */
  noEarlier: boolean;
  /** The dates that have a Matrix, oldest first. */
  matrixDates: CalendarDate[];
  taskList: Task[];
  matrix: Matrix;
  /**
   * The time the screen was last drawn for. It moves on only when that changes what's allowed on screen (the day,
   * whether tomorrow is reachable, whether the Matrix on screen is frozen); every change is checked against the clock
   * at the moment it's made.
   */
  now: Date;
};

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

/** How often the screen looks at the clock. */
const CLOCK_CHECK_MS = 1000;

/** What the time decides on screen, while `date` is viewed: the screen is redrawn only when this changes. */
const clockKey = (date: CalendarDate, now: Date) => `${localDate(now)} ${latestPlaceableDate(now)} ${isFrozen(date, now)}`;

/** The dates that have a Matrix, oldest first, with `date` among them if `hasMatrix`, and not otherwise. */
function withDate(dates: CalendarDate[], date: CalendarDate, hasMatrix: boolean) {
  const others = dates.filter((d) => d !== date);
  return hasMatrix ? [...others, date].sort() : others;
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

  constructor(client: Client, now: Date = new Date()) {
    this.client = client;
    // The app always opens on today.
    const today = localDate(now);
    this.confirmed = this.state = { date: today, noEarlier: false, matrixDates: [], taskList: [], matrix: emptyMatrix(today), now };
    // Nothing is scheduled to happen at 06:00 or 20:00: the screen just looks at the clock now and then, and redraws
    // when what it allows has changed, e.g. a Matrix on screen freezing, which then stays and refuses changes. It
    // only reads the local clock: nothing is fetched. One Store lives as long as the page, so it's never cleared.
    setInterval(() => this.watchClock(), CLOCK_CHECK_MS);
  }

  private watchClock() {
    const now = new Date();
    if (clockKey(this.confirmed.date, now) === clockKey(this.confirmed.date, this.confirmed.now)) return;
    this.confirmed = { ...this.confirmed, now };
    this.show();
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

  /**
   * Fetches the Task List, the dates that have a Matrix, and the Matrix on screen; changes not yet sent stay on top of
   * what comes back.
   */
  refresh() {
    this.enqueue(async () => {
      const date = this.confirmed.date;
      const [taskList, matrixDates, matrix] = await Promise.all([this.client.taskList(), this.client.matrixDates(), this.client.matrix(date)]);
      // If another date has been chosen meanwhile, its own fetch brings its Matrix.
      const viewed = this.confirmed.date === date ? { matrix: matrix ?? emptyMatrix(date) } : {};
      this.confirmed = { ...this.confirmed, taskList, matrixDates, ...viewed };
      this.show();
    });
  }

  /** Shows `date`'s Matrix: at once as an empty frame, then as fetched. Looking at a date creates nothing. */
  private view(date: CalendarDate) {
    this.confirmed = { ...this.confirmed, date, noEarlier: false, matrix: emptyMatrix(date), now: new Date() };
    this.show();
    this.refresh();
  }

  /** Where ‹ goes, at the time the screen was drawn for: `null` when it's disabled. */
  previous = (s: State = this.state) => (s.noEarlier ? null : (previousDate(s.date, s.matrixDates, s.now) ?? 'no-earlier'));

  /** Where › goes, at the time the screen was drawn for: `null` when it's disabled. */
  next = (s: State = this.state) => (s.noEarlier ? s.date : nextDate(s.date, s.matrixDates, s.now));

  /** ‹: to the previous date that has a Matrix (or today), or, past the oldest, to "No earlier Matrix". */
  goBack() {
    const to = this.previous({ ...this.state, now: new Date() });
    if (to === 'no-earlier') this.showNoEarlier(true);
    else if (to) this.view(to);
  }

  /** ›: back from "No earlier Matrix", or on to the next date that has a Matrix, today, or (from 20:00) tomorrow. */
  goForward() {
    if (this.state.noEarlier) return this.showNoEarlier(false);
    const to = this.next({ ...this.state, now: new Date() });
    if (to) this.view(to);
  }

  private showNoEarlier(noEarlier: boolean) {
    this.confirmed = { ...this.confirmed, noEarlier };
    this.show();
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

  /**
   * Moves a Task List Task into a Quadrant of the Matrix on screen, at `position` there or at its bottom without one.
   * Returns whether the rules allow it.
   */
  place(id: string, quadrant: Quadrant, position?: number) {
    const { date, taskList, noEarlier } = this.state;
    const task = taskList.find((t) => t.id === id);
    if (noEarlier || !task || refusalToPlace(task, date, new Date())) return false;
    this.change(
      (s) => {
        if (!s.taskList.some((x) => x.id === id)) return s;
        const out =
          s.matrix.date === date
            ? putTask(s, id, quadrant, position ?? s.matrix.quadrants[quadrant].length, (t) => ({ ...t, matrixDate: date, quadrant }))
            : // Another date is on screen by now: the Task just leaves the Task List.
              { ...s, taskList: s.taskList.filter((t) => t.id !== id) };
        // The first Placement on a date creates its Matrix.
        return { ...out, matrixDates: withDate(out.matrixDates, date, true) };
      },
      () => this.client.place(id, date, quadrant, position),
    );
    return true;
  }

  /** Whether the Matrix on screen is frozen, at the time the screen was drawn for. */
  frozen = (s: State = this.state) => isFrozen(s.date, s.now);

  /**
   * Changes a Task's text. Empty text deletes a Task in the Task List, and leaves a placed Task's text as it was, so
   * that a placed Task can't be deleted by clearing it.
   */
  edit(id: string, text: string) {
    const task = findTask(this.state, id);
    if (!task || refusalFor('edit', task, new Date())) return;
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
    if (!task || refusalFor(completed ? 'complete' : 'uncomplete', task, new Date())) return;
    const completedAt = completed ? new Date().toISOString() : null;
    this.change(
      (s) => updateTask(s, id, (t) => ({ ...t, completedAt })),
      () => (completed ? this.client.complete(id) : this.client.uncomplete(id)),
    );
  }

  /** Sends an unfinished placed Task back to the Task List, at `position` there or at its top without one, leaving no trace in the Matrix. */
  returnToTaskList(id: string, position?: number) {
    const task = findTask(this.state, id);
    if (!task || refusalFor('return', task, new Date())) return;
    const returned = (t: Task): Task => ({ ...t, matrixDate: null, quadrant: null, completedAt: null });
    // Returning the last Task removes its Matrix.
    const last = (m: Matrix) => QUADRANTS.every((q) => m.quadrants[q].every((t) => t.id === id));
    const wasLast = last(this.state.matrix);
    this.change(
      (s) => {
        if (s.taskList.some((x) => x.id === id)) return s;
        if (findTask(s, id)) {
          const out = putTask(s, id, 'task-list', position ?? 0, returned);
          return { ...out, matrixDates: withDate(out.matrixDates, out.matrix.date, !last(s.matrix)) };
        }
        // Another date is on screen by now: the Task just joins the Task List.
        const taskList = [...s.taskList];
        taskList.splice(position ?? 0, 0, returned(task));
        return { ...s, taskList, matrixDates: withDate(s.matrixDates, task.matrixDate!, !wasLast) };
      },
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
    const now = new Date();
    if (!task || refusalToMove(task, this.destination(to), now)) return;
    if (listOf(this.state, to)[index]?.id === id) return;
    const date = this.state.matrix.date;
    this.change(
      (s) => {
        const t = findTask(s, id);
        if (!t || refusalToMove(t, this.destination(to, s), now)) return s;
        return putTask(s, id, to, index, (x) => (to === 'task-list' ? x : { ...x, quadrant: to }));
      },
      () => this.client.move(id, to === 'task-list' ? to : { date, quadrant: to }, index),
    );
  }

  /**
   * What dropping the Task with `id` into `to` does, at the position it's dropped at; `null` if the rules refuse it.
   * Checked against the clock at the moment, so a drag that outlasts its Matrix's freezing snaps back.
   */
  private dropping(id: string, to: ListId): ((index: number) => void) | null {
    const task = findTask(this.state, id);
    const now = new Date();
    // With no Matrix on screen, only the Task List takes drops.
    if (!task || (this.state.noEarlier && to !== 'task-list')) return null;
    if (refusalToMove(task, this.destination(to), now) === null) return (index) => this.move(id, to, index);
    if (to === 'task-list') return refusalFor('return', task, now) ? null : (index) => this.returnToTaskList(id, index);
    return refusalToPlace(task, this.state.matrix.date, now) ? null : (index) => this.place(id, to, index);
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
