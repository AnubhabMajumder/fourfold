# Fourfold

A personal task manager built around the Eisenhower Matrix, with a hand-drawn look. You write Tasks down, then decide for yourself which Quadrant each one belongs in. Fourfold never ranks or nags.

Fourfold runs on your own laptop. It keeps your Tasks in a local SQLite file, needs no account and works without an internet connection.

## Contents

- [How it works](#how-it-works)
- [Getting started (Windows)](#getting-started-windows)
- [Using Fourfold](#using-fourfold)
- [Your data and troubleshooting](#your-data-and-troubleshooting)
- [Development](#development)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Architecture](#architecture)
- [Not in v1](#not-in-v1)

## How it works

- **Task List.** Every Task is written here first. It's one ongoing list that belongs to no date. New Tasks go to the top, and you set the order.
- **Matrix.** Each date has its own Matrix with four **Quadrants**: Important + Urgent, Important + Not Urgent, Not Important + Urgent and Not Important + Not Urgent. You place a Task from the Task List into a Quadrant, at the position you choose.
- **Completing.** A Completed Task is struck through with a scribble and stays where it was, so the Matrix becomes a record of your day.
- **Which dates you can plan.** You can place Tasks into today's Matrix and into any earlier Matrix that isn't frozen. From 8pm you can also place them into tomorrow's.
- **Freezing.** A Matrix freezes at 6am on the day after its date. After that it can't be changed, but you can still look at it, and it's kept for good.
- **Matrices come and go with their Tasks.** A Matrix is created by its first Placement. It disappears if you return all its Tasks to the Task List before it freezes. Unfinished Tasks are not carried forward to the next day.

What each kind of Task allows, while its Matrix isn't frozen:

| Task | Edit text | Move | Complete | Un-complete | Return to Task List | Delete |
|---|---|---|---|---|---|---|
| In the Task List | yes | within the Task List | no | no | n/a | yes |
| Placed | yes | within the same Matrix | yes | no | yes | no |
| Completed | yes | within the same Matrix | no | yes | no | no |

## Getting started (Windows)

You need [Node.js](https://nodejs.org) 22 or later and [pnpm](https://pnpm.io).

1. In this folder, run:

   ```sh
   pnpm install
   pnpm build
   ```

2. Run `pnpm shortcut`. It puts a **Start Fourfold** shortcut on your desktop.
3. Double-click **Start Fourfold**. If Fourfold isn't running, it starts it, then opens http://localhost:4739 in your browser. If Fourfold is already running, it just opens it.
4. Optional: to install Fourfold as an app, use the install button in the address bar of Chrome or Edge. From then on, **Start Fourfold** opens the installed app instead of a browser tab.

Fourfold doesn't start with Windows; use the shortcut when you want it.

After pulling changes, run `pnpm build` again. If you move this folder, run `pnpm shortcut` again.

## Using Fourfold

| To | Do this |
|---|---|
| Write a Task | Type in **Write a Task…** and press Enter, or click **add** |
| Place a Task | Drag it into a Quadrant, or click its mini-Matrix icon and pick a Quadrant |
| Reorder | Drag within the Task List, or within and between the Quadrants of the same Matrix |
| Return a Task to the Task List | Drag it back, or click its mini-list icon |
| Complete or un-complete | Tick or untick its checkbox |
| Edit a Task | Double-click its text. Enter or clicking away saves; Esc cancels |
| Delete a Task | Hover over it in the Task List and click ×, or clear its text |
| Go to another date | Use ‹ and › next to the date |
| Change the look | Click the gear in the Matrix's bottom-right corner. It offers six colour schemes and two strike styles (zigzag or rough line) |

On a touch screen, press and hold a Task to drag it.

## Your data and troubleshooting

- Your Tasks are kept in `%LOCALAPPDATA%\Fourfold\fourfold.db`. There are no backups in v1, so losing this file loses every Task.
- Your colour scheme and strike style are saved in the browser.
- **"Fourfold isn't running"** appears when the page can't reach Fourfold. Start it with the **Start Fourfold** shortcut, and the page catches up by itself.
- **If Fourfold won't start**, its output is in `%LOCALAPPDATA%\Fourfold\server.log` and `server-errors.log`.
- **If port 4739 is in use**, Fourfold says so and exits. It never moves to another port, because the installed app and your saved settings belong to that exact address. Close whatever is using the port, then start Fourfold again.

## Development

| Command | What it does |
|---|---|
| `pnpm start` | Starts the API, which also serves the last built web app |
| `pnpm dev:web` | Runs the web app with hot reload; it forwards `/api` to the API started with `pnpm start` |
| `pnpm build` | Builds the web app and the API server |
| `pnpm typecheck` | Type-checks every package |
| `pnpm test` | Runs the API tests and the web unit tests |
| `pnpm test:e2e` | Builds, then runs the Playwright tests |
| `pnpm shortcut` | Creates the **Start Fourfold** desktop shortcut |

The API reads these environment variables. They exist for testing; normal use needs none of them.

| Variable | Default | Meaning |
|---|---|---|
| `FOURFOLD_DB` | `%LOCALAPPDATA%\Fourfold\fourfold.db` | The database file |
| `FOURFOLD_NOW` | the real clock | A local start time for the clock, e.g. `2026-09-24T19:59`; the clock runs on from there |
| `FOURFOLD_PORT` | `4739` | The port |

## Project structure

```
apps/
  api/        Local API: Hono, Drizzle and better-sqlite3; also serves the built web app
  web/        Web app: React and Vite; installable as an app through its web manifest
packages/
  core/       Shared domain model, Matrix rules, dates, API client and the fixed port (no DOM)
e2e/          Playwright tests against the built server
scripts/      start-fourfold.ps1 and create-shortcut.ps1, for the Start Fourfold shortcut
docs/         Spec, architecture decisions and agent notes
```

## Testing

Tests go through public seams: HTTP requests, and what a user sees and does in the browser.

- **API tests** (`apps/api/test`, Vitest) call the app in-process with an in-memory SQLite database and a clock the test controls. They cover every Matrix rule, including the 8pm and 6am boundaries, every case in the table above and Task positions.
- **Web unit tests** (`apps/web/test`, Vitest) check, among other things, that the strike has 3:1 contrast in every colour scheme.
- **End-to-end tests** (`e2e/`, Playwright) start the real built server for each test, with a temporary database and a set clock. They cover drag and drop, editing, completing, ‹ › navigation, the "isn't running" card and settings.

The end-to-end tests use port 4799, so they don't clash with a Fourfold you're running. To run several checkouts at once, give each its own port with `FOURFOLD_TEST_PORT`.

## Architecture

- **One process.** The API serves both `/api` and the built web app on `http://localhost:4739`, listening on `127.0.0.1` only. The browser keeps no copy of the data, so the app needs the API running.
- **Rules live once, in `core`.** The API uses them to refuse changes, answering `409` with a reason code such as `matrix_frozen`, and it has the final say. The web app uses the same code to decide what's allowed on screen.
- **The screen updates first.** The web app shows a change at once and sends it in the background. It undoes the change if the API refuses it, and shows the "isn't running" card if the API can't be reached.
- **Freezing is calculated, not stored.** Whether a Matrix is frozen comes from the local clock every time it's checked, so nothing has to run at 6am.
- **The hand-drawn look is vector lines only.** Boxes, icons, dividers and strikes are seeded SVG paths (rough.js and perfect-freehand), so each looks the same on every render. Task text stays real text in a handwriting font (Kalam and Caveat, bundled with the app).
- **Ready for later.** `core` has no DOM imports, so a future mobile app can share it. The database follows portability rules (UUID ids, UTC ISO timestamps, no SQLite-only features), so an online database can come later.

More detail: [CONTEXT.md](CONTEXT.md) (the domain language), [docs/spec/v1.md](docs/spec/v1.md) (the v1 spec) and [docs/adr/](docs/adr/) (architecture decisions).

## Not in v1

- Multi-device sync and a mobile app
- Backups of the database file
- Accounts or shared use
- Due dates, reminders, tags, subtasks and undo
- A calendar or history view; ‹ and › are the only way between dates
- Starting Fourfold with Windows
