// Starts Fourfold: the local API and the built web app, together on http://localhost:<PORT>, listening on 127.0.0.1 only.
//
// For tests only, three environment variables override the defaults:
//   FOURFOLD_DB    the database file (default: %LOCALAPPDATA%\Fourfold\fourfold.db)
//   FOURFOLD_NOW   a local start time for the clock, e.g. 2026-09-24T19:59 (default: the real clock); it ticks on from there
//   FOURFOLD_PORT  the port (default: the fixed port in core)
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { PORT } from '@fourfold/core';
import { createApp, type Clock } from './app.ts';
import { openDatabase } from './db.ts';

const HOST = '127.0.0.1';

function defaultDatabaseFile() {
  const base = process.env.LOCALAPPDATA ?? join(homedir(), '.local', 'share');
  return join(base, 'Fourfold', 'fourfold.db');
}

function clockFrom(start: string | undefined): Clock | undefined {
  if (!start) return undefined;
  const startsAt = new Date(start).getTime();
  if (Number.isNaN(startsAt)) throw new Error(`FOURFOLD_NOW is not a date: ${start}`);
  const offset = startsAt - Date.now();
  return () => new Date(Date.now() + offset);
}

const port = Number(process.env.FOURFOLD_PORT ?? PORT);
const file = process.env.FOURFOLD_DB ?? defaultDatabaseFile();
const app = createApp({ db: openDatabase(file), clock: clockFrom(process.env.FOURFOLD_NOW) });

// Resolves to apps/web/dist both from src/ (pnpm start) and from dist/ (the built server).
const webRoot = fileURLToPath(new URL('../../web/dist', import.meta.url));
app.use('*', serveStatic({ root: webRoot }));
app.get('*', serveStatic({ root: webRoot, path: 'index.html' }));

const server = serve({ fetch: app.fetch, hostname: HOST, port }, () => {
  console.log(`Fourfold is running on http://localhost:${port}`);
  console.log(`Tasks are kept in ${file}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    // Never fall back to another port: the installed app and the saved colour scheme belong to this exact origin.
    console.error(`Fourfold can't start: port ${port} is already in use by another program.`);
    console.error(`Close whatever is using port ${port} (or the Fourfold already running), then start Fourfold again.`);
  } else {
    console.error(`Fourfold can't start: ${err.message}`);
  }
  process.exit(1);
});
