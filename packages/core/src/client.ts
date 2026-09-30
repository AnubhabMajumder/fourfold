import type { CalendarDate } from './dates.ts';
import type { Matrix, Quadrant, Task } from './model.ts';
import type { Refusal } from './rules.ts';

/** The API refused the change (409): the rules forbid it. */
export class RefusedError extends Error {
  readonly reason: Refusal;
  constructor(reason: Refusal) {
    super(`Refused: ${reason}`);
    this.reason = reason;
  }
}

/** The request never got an answer: the API isn't running. */
export class UnreachableError extends Error {}

/** The API answered with something other than success or a refusal. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`API error ${status}`);
    this.status = status;
  }
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** The typed client for the local API. */
export function createClient(baseUrl = '', fetchImpl: Fetch = (input, init) => fetch(input, init)) {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}/api${path}`, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
      });
    } catch {
      throw new UnreachableError('Fourfold isn’t running');
    }
    if (res.status === 409) throw new RefusedError(((await res.json()) as { reason: Refusal }).reason);
    if (!res.ok) throw new ApiError(res.status);
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  return {
    taskList: () => call<Task[]>('GET', '/task-list'),
    /** A date's Matrix, or `null` if nothing has been placed on that date. */
    async matrix(date: CalendarDate): Promise<Matrix | null> {
      try {
        return await call<Matrix>('GET', `/matrices/${date}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    write: (id: string, text: string) => call<Task>('POST', '/tasks', { id, text }),
    /** Places a Task at `position` in the Quadrant, or at its bottom without one. */
    place: (id: string, date: CalendarDate, quadrant: Quadrant, position?: number) =>
      call<Task>('POST', `/tasks/${id}/place`, { date, quadrant, position }),
  };
}

export type Client = ReturnType<typeof createClient>;
