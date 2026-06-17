# Query Studio

A lightweight analytics workbench for telecom data: connect a data source, write or
build a query, turn the result into a chart, and assemble charts onto a dashboard.

```
Data Source → Query → Results → Widget → Dashboard
```

## Auth

The app requires an account — register or log in on first visit. Sessions
are a JWT in an httpOnly cookie; saved queries, widgets, and dashboards are
scoped to the logged-in user server-side (see Backend below).

## Tabs

- **Studio** — the home page. A SQL editor (Monaco, with syntax highlighting,
  line numbers, and schema-aware autocomplete) you can type into directly. Run,
  save, format, and clear a query; see results, row count, and execution time;
  preview the result as a table/KPI/bar/pie/line/area chart and turn it into a
  saved widget.
- **Query Builder** — a 6-step wizard (dataset → columns → filters →
  aggregations → group by → generate SQL) for building queries visually,
  without writing SQL. An **Advanced mode** toggle reveals the operator
  toolbar, KPI metadata fields, and the **Join Builder** (pick a right-hand
  table, join type, and ON keys; joined fields show up as qualified
  `table.column` chips you can add to Select/Filter/Group By). "Send to
  Studio" pushes the generated SQL into the Studio editor, and Studio can
  push typed SQL back the other way with **"Load into Builder"** (parsed via
  `node-sql-parser`; supports a single-table SELECT with WHERE/GROUP BY/
  single-column ORDER BY/LIMIT — joins, subqueries, and HAVING aren't yet
  representable in the visual tree, so those are rejected with a clear error
  instead of silently mis-loading).
- **Data Sources** — load data from: built-in demo telecom datasets, CSV/TSV/
  Excel/JSON file upload (drag-and-drop, multi-file, schema preview), a REST
  API (fetched server-side, through an SSRF-guarded proxy, to avoid CORS), or
  a real SQLite/PostgreSQL/MySQL/SQL Server database connection.
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

An Express server (`server/`) owns persistence, auth, and anything a browser
can't do safely on its own:

- **Auth** — register/login/logout/`me` (`server/routes/auth.js`), password
  hashing (`server/auth/password.js`), JWT issuance/verification
  (`server/auth/jwt.js`) carried in an httpOnly cookie, and a
  `requireAuth` middleware gating the persistence routes.
- **Persistence** — user accounts, queries, widgets, and dashboards are
  stored server-side in Postgres (`server/db/appDb.js`, via `pg`, connected
  through `DATABASE_URL`) and served through a generic CRUD collection API
  (`server/routes/collections.js`); the frontend talks to it via
  `makeCollectionApi()` (`src/lib/apiClient.ts`) instead of `localStorage`.
  This is a separate concern from the Data Sources tab below — it's the
  app's *own* backing store, not a user-provided data source.
- **Database connections** for the Data Sources tab — SQLite
  (`node:sqlite`), PostgreSQL (`pg`), MySQL (`mysql2`), and SQL Server
  (`mssql`) drivers (`server/db/`) connect, list tables, and import a
  table's rows for the frontend to query. (A user could point this at their
  own Postgres instance too — that's unrelated to the app's persistence
  database above, just a coincidence of using the same driver.)
- **SSRF protection** (`server/security/ssrfGuard.js`) on the REST API proxy
  (`/api/proxy/fetch`) — blocks requests to private/loopback/link-local
  addresses before they're fetched, so the Data Sources tab can query
  external APIs without exposing an open relay into internal infra.
- **Rate limiting** (`express-rate-limit`) on the auth routes and the proxy,
  and a request body size cap (`express.json({ limit: '10mb' })`) on
  everything else.
- **CORS** — locked down in production, permissive only in dev.

In production the same server also serves the built frontend (`dist/`), so
the whole app is a **single deployable process** — see Deployment below.

## Tech stack

React 19 + TypeScript, Vite (with route-level code-splitting via
`React.lazy`/`Suspense`, and a dynamic `import()` for `xlsx` so it's only
loaded when an Excel file is actually dropped), Tailwind v4, hand-built
shadcn/ui-style primitives (Radix + `cva`), [DnD Kit](https://dndkit.com) for
drag-and-drop, Zustand for state (persisted server-side, see Backend),
Monaco Editor for the SQL editor, `node-sql-parser` for SQL → builder
parsing, Recharts for charts, react-grid-layout for the dashboard grid,
AlaSQL for in-browser SQL execution, Express + `pg` + `mysql2` + `mssql` +
`node:sqlite` + `jsonwebtoken` for the backend. Vitest for unit tests, with
a GitHub Actions workflow (`.github/workflows/ci.yml`) running
typecheck/lint/test/build on every push.

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
npm run lint           # eslint .
npm run test           # vitest run — unit tests for SQL gen/parse, validation, engine, join execution
npm start              # node server/index.js — serves dist/ + the API on one port
```

## Deployment (Render)

This repo includes a `render.yaml` blueprint for a single Node web service:

1. Push this repo to GitHub.
2. On [Render](https://render.com), New → Blueprint, point it at the repo.
   It will build with `npm install && npm run build` and start with
   `npm start`, serving the frontend and API from one process/port.
3. **Set `JWT_SECRET` in the Render dashboard** (Environment tab) to a random
   value, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   `render.yaml` declares the var but deliberately doesn't commit a value
   (`sync: false`). Without it, every restart/redeploy generates a new
   in-memory secret and silently logs everyone out.
4. **Provision a Postgres database and set `DATABASE_URL` in the Render
   dashboard.** The app's own persistence (user accounts, saved
   queries/widgets/dashboards) requires Postgres — it's a hard requirement,
   not optional, since `server/db/appDb.js` throws on startup if
   `DATABASE_URL` is unset. Any standard Postgres host works (Render's own
   Postgres add-on, Neon, Supabase, etc.) — this is independent of the free
   vs. paid web service plan, so persistence works correctly even on
   Render's free tier.
5. No database is required for the default *query* experience (everything
   runs in-browser against AlaSQL using sample data or an uploaded CSV). If
   you want real Postgres/MySQL/SQL Server connections to work from the
   **Data Sources tab** (a separate concern from the app's own persistence
   database above), make sure the connecting host/port/credentials are
   reachable from Render's network.

For any other Node host (Railway, Fly.io, a plain VM, etc.), the same two
commands apply: `npm install && npm run build`, then `npm start` — just make
sure `JWT_SECRET` and `DATABASE_URL` are set in that host's environment too.

## Known limitations
- **Password hashing uses Node's built-in `scrypt`**, not a dedicated
  library like bcrypt/argon2 — fine for this app's scale, but worth
  revisiting before handling sensitive production data.
- **Joins are scoped to one right-hand table per join, and only the
  active dataset can be the left-hand/`FROM` table** — there's no
  arbitrary multi-hop join graph, and the Join Builder's bundled demo table
  (`dim_vendor`) plus any CSV you add as a join table live in memory only
  (not persisted server-side like queries/widgets/dashboards are).
- **Builder → SQL → Builder sync is best-effort, not lossless**: `node-sql-
  parser` only recognizes the subset of SQL the visual builder can already
  represent (single table, no subqueries/HAVING/multi-column ORDER BY/joins
  loaded back in) — anything outside that subset is rejected with an
  explanatory error rather than silently mis-loaded.
- **Oracle** is not implemented (SQLite, PostgreSQL, MySQL, and SQL Server
  all connect for real).
