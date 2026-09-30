// Kept portable for a later online database: UUID ids, UTC ISO timestamps, nothing SQLite-only.
import { sql } from 'drizzle-orm';
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { QUADRANTS } from '@fourfold/core';

/**
 * One row per date that has a Matrix. The date itself is the key (not a UUID) so that a later multi-device setup
 * can never create two Matrices for the same date.
 */
export const matrices = sqliteTable('matrices', {
  date: text('date').primaryKey(),
});

export const tasks = sqliteTable(
  'tasks',
  {
    /** Created by the web app, so an optimistic update already knows it. */
    id: text('id').primaryKey(),
    text: text('text').notNull(),
    createdAt: text('created_at').notNull(),
    /** Empty while the Task is in the Task List. A Matrix can't be deleted while any Task belongs to it. */
    matrixDate: text('matrix_date').references(() => matrices.date, { onDelete: 'restrict' }),
    quadrant: text('quadrant', { enum: QUADRANTS }),
    /** A fractional-index key: sorting by it gives the user's order, and a move rewrites only the moved row. */
    position: text('position').notNull(),
    completedAt: text('completed_at'),
  },
  (t) => [
    check('tasks_text_not_empty', sql`length(trim(${t.text})) > 0`),
    check('tasks_placed_in_a_quadrant', sql`(${t.matrixDate} is null) = (${t.quadrant} is null)`),
    check('tasks_completed_only_when_placed', sql`${t.completedAt} is null or ${t.matrixDate} is not null`),
    index('tasks_by_list').on(t.matrixDate, t.quadrant, t.position),
  ],
);

export type TaskRow = typeof tasks.$inferSelect;
