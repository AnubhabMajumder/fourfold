/**
 * Why a change was refused. The API answers 409 with one of these; the web app uses the same checks to decide
 * what to offer on screen.
 */
export type Refusal = 'empty_text' | 'task_exists';

export const isBlank = (text: string) => text.trim() === '';
