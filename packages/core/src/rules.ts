import { addDays, localDate, type CalendarDate } from './dates.ts';
import type { Quadrant, Task } from './model.ts';

/**
 * Why a change was refused. The API answers 409 with one of these; the web app uses the same checks to decide
 * what to offer on screen.
 */
export type Refusal =
  | 'empty_text'
  | 'task_exists'
  | 'task_not_found'
  /** Only a Task in the Task List can be placed, deleted, or moved within the Task List. */
  | 'task_already_placed'
  | 'date_not_placeable'
  /** A Frozen Matrix refuses every change: nothing is placed into it, and nothing in it is moved, returned, edited, completed or un-completed. */
  | 'matrix_frozen'
  | 'task_not_placed'
  /** A placed Task moves only within its own Matrix: there is no direct move from one Matrix to another. */
  | 'task_in_another_matrix'
  | 'task_not_completed'
  | 'task_already_completed'
  | 'completed_task_not_returnable'
  /** A Completed Task cannot be deleted directly: it must be un-completed and returned to the Task List first. */
  | 'completed_task_not_deletable';

export const isBlank = (text: string) => text.trim() === '';

/** Where a Task is in its life: waiting in the Task List, placed in a Matrix, or placed and Completed. */
export type TaskState = 'in-task-list' | 'placed' | 'completed';

export const stateOf = (task: Pick<Task, 'matrixDate' | 'completedAt'>): TaskState =>
  task.matrixDate === null ? 'in-task-list' : task.completedAt === null ? 'placed' : 'completed';

/** A change to a Task that already exists. Placement, which also needs a placeable date, is `refusalToPlace`. */
export type Change = 'edit' | 'move' | 'complete' | 'uncomplete' | 'return' | 'delete';

/** What each state allows: `null` where the change is allowed, otherwise why it's refused. */
const STATE_TABLE: Record<TaskState, Record<Change, Refusal | null>> = {
  'in-task-list': {
    edit: null,
    move: null,
    complete: 'task_not_placed',
    uncomplete: 'task_not_placed',
    return: 'task_not_placed',
    delete: null,
  },
  placed: {
    edit: null,
    move: null,
    complete: null,
    uncomplete: 'task_not_completed',
    return: null,
    delete: 'task_already_placed',
  },
  completed: {
    edit: null,
    move: null,
    complete: 'task_already_completed',
    uncomplete: null,
    return: 'completed_task_not_returnable',
    delete: 'completed_task_not_deletable',
  },
};

/**
 * Whether `date`'s Matrix is frozen at `now`: it is once the laptop's local time is at or past 06:00 on the day after
 * its date.
 *
 * Freezing is always calculated from the clock at the moment of each check, never stored, and no scheduled job flips
 * it: the API is often not running at 6am, so a stored flag or a job would miss the moment, while the calculation is
 * right whenever it's asked.
 */
export function isFrozen(date: CalendarDate, now: Date): boolean {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return now >= new Date(y, m - 1, d + 1, 6);
}

/** From this local hour on, tomorrow is placeable too. */
const EVENING_HOUR = 20;

/**
 * The latest date that accepts Placement at `now`: today, or tomorrow from 20:00 local time. Nothing beyond tomorrow
 * ever does. It's also as far as the user can look ahead.
 */
export function latestPlaceableDate(now: Date): CalendarDate {
  const today = localDate(now);
  return now.getHours() >= EVENING_HOUR ? addDays(today, 1) : today;
}

/**
 * Where ‹ goes from `date`: straight to the previous date that has a Matrix, or to today, which is always reachable;
 * `null` past the oldest one.
 */
export function previousDate(date: CalendarDate, matrixDates: readonly CalendarDate[], now: Date): CalendarDate | null {
  const earlier = [...matrixDates, localDate(now)].filter((d) => d < date);
  return earlier.length ? earlier.reduce((a, b) => (a > b ? a : b)) : null;
}

/**
 * Where › goes from `date`: to the next date that has a Matrix, or to today, or (from 20:00) to tomorrow, whichever
 * comes first; `null` at the latest placeable date, beyond which nothing can be looked at.
 */
export function nextDate(date: CalendarDate, matrixDates: readonly CalendarDate[], now: Date): CalendarDate | null {
  const latest = latestPlaceableDate(now);
  const later = [...matrixDates, localDate(now), latest].filter((d) => d > date && d <= latest);
  return later.length ? later.reduce((a, b) => (a < b ? a : b)) : null;
}

/** Whether a date's Matrix accepts Placement at `now`: it isn't frozen, and isn't after the latest placeable date. */
export const isPlaceable = (date: CalendarDate, now: Date) => !isFrozen(date, now) && date <= latestPlaceableDate(now);

/** Why `change` to `task` at `now` is refused, or `null` if the rules allow it. In a Frozen Matrix every change is refused. */
export function refusalFor(change: Change, task: Pick<Task, 'matrixDate' | 'completedAt'>, now: Date): Refusal | null {
  if (task.matrixDate !== null && isFrozen(task.matrixDate, now)) return 'matrix_frozen';
  return STATE_TABLE[stateOf(task)][change];
}

/** Why placing `task` into `date`'s Matrix at `now` is refused, or `null` if the rules allow it. */
export function refusalToPlace(task: Pick<Task, 'matrixDate'>, date: CalendarDate, now: Date): Refusal | null {
  if (task.matrixDate !== null) return 'task_already_placed';
  if (isFrozen(date, now)) return 'matrix_frozen';
  if (!isPlaceable(date, now)) return 'date_not_placeable';
  return null;
}

/** Where a Task can be put: the Task List, or a Quadrant of a date's Matrix. */
export type Destination = 'task-list' | { date: CalendarDate; quadrant: Quadrant };

/**
 * Why moving `task` to a position in `to` is refused, or `null` if the rules allow it. A move keeps a Task in the
 * Task List or in its own Matrix: getting from one to the other takes a Placement or a return.
 */
export function refusalToMove(task: Pick<Task, 'matrixDate' | 'completedAt'>, to: Destination, now: Date): Refusal | null {
  const refusal = refusalFor('move', task, now);
  if (refusal) return refusal;
  if (to === 'task-list') return task.matrixDate === null ? null : 'task_already_placed';
  if (task.matrixDate === null) return 'task_not_placed';
  return task.matrixDate === to.date ? null : 'task_in_another_matrix';
}
