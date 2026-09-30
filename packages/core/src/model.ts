import type { CalendarDate } from './dates.ts';

/** The fixed port the local API listens on. The installed app and saved settings are tied to this exact origin. */
export const PORT = 4739;

export const QUADRANTS = ['important-urgent', 'important-not-urgent', 'not-important-urgent', 'not-important-not-urgent'] as const;
export type Quadrant = (typeof QUADRANTS)[number];

export const QUADRANT_NAMES: Record<Quadrant, string> = {
  'important-urgent': 'Important + Urgent',
  'important-not-urgent': 'Important + Not Urgent',
  'not-important-urgent': 'Not Important + Urgent',
  'not-important-not-urgent': 'Not Important + Not Urgent',
};

/** A Task as the API sends it. A Task in the Task List has no `matrixDate` and no `quadrant`. */
export type Task = {
  id: string;
  text: string;
  createdAt: string;
  matrixDate: CalendarDate | null;
  quadrant: Quadrant | null;
  completedAt: string | null;
};

/** A date's Matrix as the API sends it: its placed Tasks, one ordered list per Quadrant. */
export type Matrix = {
  date: CalendarDate;
  quadrants: Record<Quadrant, Task[]>;
};

/** A Matrix with nothing placed in it yet, as today's is drawn before its first Placement. */
export const emptyMatrix = (date: CalendarDate): Matrix => ({
  date,
  quadrants: Object.fromEntries(QUADRANTS.map((q) => [q, []])) as unknown as Record<Quadrant, Task[]>,
});

/** A Task just written: it starts in the Task List, not yet placed or completed. */
export const newTask = (id: string, text: string, createdAt: string): Task => ({
  id,
  text,
  createdAt,
  matrixDate: null,
  quadrant: null,
  completedAt: null,
});
