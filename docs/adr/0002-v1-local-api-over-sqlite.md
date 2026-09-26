# v1 uses a local API over SQLite instead of PowerSync

v1 runs on one laptop, so the web app talks directly to a small local API (Node + TypeScript: Hono, Drizzle, better-sqlite3) that keeps the Tasks in a single SQLite file, instead of the PowerSync + Postgres stack chosen for the Hub in ADR 0001. With one device there is nothing to sync, and PowerSync would have meant three always-on processes (Postgres, the PowerSync service, and our own token/upload API), with Postgres in Docker Desktop costing 1–2 GB of RAM on Windows Home. We accepted that the browser keeps no copy of the data: the app needs the local API running to do anything, and adding multi-device sync later means changing the data path, not just deploying a Hub.

## Consequences

- The same API process serves the built web app and `/api` on `127.0.0.1` only; the user starts it by hand (no auto-start). The web app is installable via a manifest, with no service worker, and re-fetches when a window regains focus.
- To keep a later online database cheap, the API uses Drizzle, UUID ids, UTC ISO timestamps, and no SQLite-only features.
- The database file lives outside the repo (`%LOCALAPPDATA%\Fourfold\fourfold.db`). v1 has no backups, so losing that file loses every Task.
- **Local-only** (browser-only) mode is not part of v1.
