import { localDate, type CalendarDate } from './dates.ts';
import type { Task } from './model.ts';

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
  | 'task_not_placed'
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

/** Why `change` to `task` is refused, or `null` if the rules allow it. */
export const refusalFor = (change: Change, task: Pick<Task, 'matrixDate' | 'completedAt'>): Refusal | null =>
  STATE_TABLE[stateOf(task)][change];

/** Whether a date's Matrix accepts Placement at `now`. For now only today's does. */
export const isPlaceable = (date: CalendarDate, now: Date) => date === localDate(now);

/** Why placing `task` into `date`'s Matrix at `now` is refused, or `null` if the rules allow it. */
export function refusalToPlace(task: Pick<Task, 'matrixDate'>, date: CalendarDate, now: Date): Refusal | null {
  if (task.matrixDate !== null) return 'task_already_placed';
  if (!isPlaceable(date, now)) return 'date_not_placeable';
  return null;
}
