/** The fixed port the local API listens on. The installed app and saved settings are tied to this exact origin. */
export const PORT = 4739;

export const QUADRANTS = ['important-urgent', 'important-not-urgent', 'not-important-urgent', 'not-important-not-urgent'] as const;
export type Quadrant = (typeof QUADRANTS)[number];

/** A Task as the API sends it. A Task in the Task List has no `matrixDate` and no `quadrant`. */
export type Task = {
  id: string;
  text: string;
  createdAt: string;
  matrixDate: string | null;
  quadrant: Quadrant | null;
  completedAt: string | null;
};
