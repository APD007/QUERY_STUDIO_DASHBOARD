# Query Studio

A lightweight analytics workbench for telecom data: connect a data source, write or
build a query, turn the result into a chart, and assemble charts onto a dashboard.

```
Data Source → Query → Results → Widget → Dashboard
```

## Tabs

- **Studio** — the home page. A SQL editor (Monaco, with syntax highlighting,
  line numbers, and schema-aware autocomplete) you can type into directly. Run,
  save, format, and clear a query; see results, row count, and execution time;
  preview the result as a table/KPI/bar/pie/line/area chart and turn it into a
  saved widget.
- **Query Builder** — a 6-step wizard (dataset → columns → filters →
  aggregations → group by → generate SQL) for building queries visually,
  without writing SQL. An **Advanced mode** toggle reveals the operator
  toolbar, KPI metadata fields, and the (Phase 2) join builder. "Send to
  Studio" pushes the generated SQL into the Studio editor.
- **Data Sources** — load data from: built-in demo telecom datasets, CSV/TSV/
  Excel/JSON file upload (drag-and-drop, multi-file, schema preview), a REST
  API (fetched server-side to avoid CORS), or a real SQLite/PostgreSQL
  database connection.
- **Dashboard** — multiple named dashboards, each a drag-and-resize grid of
  widgets. Widgets can be duplicated, renamed, and refreshed from either the
  library or the board.

## How querying works

Everything queries **in-browser** via [AlaSQL](https://github.com/agershun/alasql),
regardless of where the data came from. A CSV upload, a demo dataset, a
database table import, and a REST API response all end up as the same shape
(an array of row objects) and are queried the same way. The Studio SQL editor
runs your typed SQL directly; the Query Builder generates SQL from an
expression-tree model built by the visual controls.

## Backend

A small Express server (`server/`) handles the things a browser can't do
safely on its own:

- Database connections (SQLite via Node's built-in `node:sqlite`, PostgreSQL
  via `pg`) — connects, lists tables, and imports a table's rows for the
  frontend to query. MySQL / SQL Server / Oracle are in the connection-type
  list but **not wired up yet** — they're left as a clearly-labelled stub
  rather than something that silently fails.
- A REST API proxy (`/api/proxy/fetch`) so external APIs can be queried from
  the Data Sources page without hitting browser CORS restrictions.

In production the same server also serves the built frontend (`dist/`), so
the whole app is a **single deployable process** — see Deployment below.

## Tech stack

React 19 + TypeScript, Vite, Tailwind v4, hand-built shadcn/ui-style
primitives (Radix + `cva`), [DnD Kit](https://dndkit.com) for drag-and-drop,
Zustand (with `localStorage` persistence) for state, Monaco Editor for the
SQL editor, Recharts for charts, react-grid-layout for the dashboard grid,
AlaSQL for in-browser SQL execution, Express + `pg` + `node:sqlite` for the
backend.

## Getting started

Requires **Node >= 22.5** (uses the experimental built-in `node:sqlite`).

```bash
npm install
npm run dev          # Vite dev server on :5173, proxies /api to :5174
npm run dev:server   # Express backend on :5174 (separate terminal)
```

Other scripts:

```bash
npm run build         # type-strips + bundles the frontend into dist/
npm run typecheck      # tsc -b --noEmit (vite build does not type-check)
npm run lint           # eslint . (currently only covers .js/.jsx)
npm start              # node server/index.js — serves dist/ + the API on one port
```

## Deployment (Render)

This repo includes a `render.yaml` blueprint for a single Node web service:

1. Push this repo to GitHub.
2. On [Render](https://render.com), New → Blueprint, point it at the repo.
   It will build with `npm install && npm run build` and start with
   `npm start`, serving the frontend and API from one process/port.
3. No database is required for the default demo experience (everything runs
   in-browser against AlaSQL). If you want real Postgres connections to work
   from the deployed app, add a Postgres instance and make sure the
   connecting host/port/credentials are reachable from Render's network.

For any other Node host (Railway, Fly.io, a plain VM, etc.), the same two
commands apply: `npm install && npm run build`, then `npm start`.

## Known limitations

- **Persistence is `localStorage` only** — queries, widgets, and dashboards
  live in the browser, not a database. Clearing site data clears them.
- **No authentication** — there's no concept of users or access control.
- **Single active dataset** — one dataset is queried at a time (per the
  in-browser AlaSQL model); multi-table joins are a defined-but-disabled
  Phase 2 feature (`JoinBuilder`).
- **MySQL / SQL Server / Oracle** connections are stubbed (UI present,
  backend not implemented) — only SQLite and PostgreSQL actually connect.
- **Builder ↔ SQL sync is one-way**: the visual Query Builder generates SQL
  into the Studio editor, but typed SQL is not parsed back into the visual
  tree (would need a real SQL parser).
- `eslint.config.js` currently only lints `.js`/`.jsx`, not the TypeScript
  source.
