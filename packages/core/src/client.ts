import type { Task } from './model.ts';
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
    write: (id: string, text: string) => call<Task>('POST', '/tasks', { id, text }),
    edit: (id: string, text: string) => call<Task>('PATCH', `/tasks/${id}`, { text }),
    remove: (id: string) => call<void>('DELETE', `/tasks/${id}`),
    /** Moves a Task within its list, so that it ends up at `index` (counted from the top). */
    move: (id: string, index: number) => call<Task>('POST', `/tasks/${id}/move`, { index }),
  };
}

export type Client = ReturnType<typeof createClient>;
