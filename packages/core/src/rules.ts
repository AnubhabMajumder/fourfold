/**
 * Why a change was refused. The API answers 409 with one of these; the web app uses the same checks to decide
 * what to offer on screen.
 */
export type Refusal =
  | 'empty_text'
  | 'task_exists'
  | 'task_not_found'
  /** Only a Task in the Task List can be deleted or moved within the Task List. */
  | 'task_already_placed';

export const isBlank = (text: string) => text.trim() === '';
