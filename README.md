# Fourfold

A Task List and a daily Eisenhower Matrix, run on your own machine. See [CONTEXT.md](CONTEXT.md) and [the v1 spec](docs/spec/v1.md).

## Running Fourfold (Windows)

You need [Node.js](https://nodejs.org) 22 or later and [pnpm](https://pnpm.io).

1. In this folder, run `pnpm install` and then `pnpm build`.
2. Run `pnpm shortcut`. It puts a **Start Fourfold** shortcut on your desktop.
3. Double-click **Start Fourfold**. It starts Fourfold if it isn't running, then opens it in your browser on http://localhost:4739. If Fourfold is already running, it just opens it.
4. To install Fourfold as an app, use your browser's install button in the address bar (Chrome or Edge). From then on, Start Fourfold opens the installed app instead of a browser tab.

Fourfold doesn't start with Windows; use the shortcut when you want it. Your Tasks are kept in `%LOCALAPPDATA%\Fourfold\fourfold.db`, and if Fourfold won't start, its output is in `%LOCALAPPDATA%\Fourfold\server.log` and `server-errors.log`.

Run `pnpm build` again after pulling changes. If you move this folder, run `pnpm shortcut` again.

## Development

- `pnpm start` starts only the API (and serves the last built web app); `pnpm dev:web` runs the web app with hot reload.
- `pnpm typecheck`, `pnpm test` (API) and `pnpm test:e2e` (Playwright; set `FOURFOLD_TEST_PORT` to run several checkouts at once).
