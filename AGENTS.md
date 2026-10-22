# Repository Guidelines

## Product specification

Read `vocab-garden-ux.md` before changing behavior. Keep product decisions there.
Use the domain terms seed bank, seed bag, garden, practice, and review consistently.
Keep page headings at the shared page-container width; narrower content wrappers belong below them.
Use the shared `Heading` component’s `navigation` and `actions` props for page-level links and controls. Follow the page-navigation rules in `vocab-garden-ux.md`; preserve scope in return URLs and avoid standalone back-link layouts.

## Structure

- `frontend/src/`: React/TypeScript app and SVG garden artwork.
  `main.tsx` only mounts providers and the router; `app.tsx` defines routes;
  `app-shell.tsx` owns session/loading/navigation. Keep page flows in `pages/`.
  Colocate page-specific components and hooks with their page; group related
  practice pages and their helpers under `pages/practice/`. Use `components/`
  and `hooks/` only for code shared across page groups.
  Check existing components before adding UI. Share repeated presentation at
  the nearest common page group; keep each page's business logic with its flow.
- `supabase/migrations/`: PostgreSQL schema, RLS policies and atomic write functions.
- `supabase/functions/garden/`: TypeScript Edge Function, domain rules and AI prompts.
- `app/`: original Python/FastAPI backend, retained for local use and parity checks.
- `pipeline/`, `schema.sql`: offline SQLite vocabulary pipeline.
- `scripts/export-supabase.py`: read-only SQLite-to-PostgreSQL export.
- `scripts/import-local.ts`: bulk local import, including automatic login accounts.
- `tests/cloud/`: TypeScript domain, PostgreSQL and local Supabase integration tests.
- `tests/test_*.py`: original API and migration tests; `tests/browser/`: Playwright.
- `.github/workflows/pages.yml`: manually triggered GitHub Pages deployment.
- `data/`: ignored private SQLite databases and generated exports; never publish.

## Commands (repository root)

- Install frontend/test dependencies: `npm ci`.
- Install legacy backend: `python3 -m venv .venv`, then `.venv/bin/pip install -r requirements.txt`.
- Legacy development: `./scripts/dev.sh`.
- Cloud development: `supabase start`, `supabase functions serve garden`, then `npm run dev` with `.env.local` configured as described in README.
- Configure local frontend environment: `npm run configure:local` (requires the local Supabase stack).
- Import all local profiles and vocabulary: `npm run import:local` (requires the local Supabase stack; credentials are saved privately under `data/`).
- Build and frontend typecheck: `npm run build`.
- Format frontend TypeScript: `npm run format:frontend`; verify: `npm run check:format:frontend`.
- Cloud typecheck: `npm run check:cloud`.
- Format cloud TypeScript: `npm run format:cloud`; verify formatting: `npm run check:format:cloud`.
- Cloud tests: `npm run test:cloud` (Node 22+ and Python 3; no Docker required).
- Local Auth/API integration: `node --import tsx tests/cloud/local-integration.ts` (local Supabase and function must be running).
- Legacy API tests: `.venv/bin/python -m unittest discover -s tests -v`.
- Legacy browser tests: `npm run build`, then `npm run test:e2e` (requires Playwright Chromium and no cloud variables in the build).
- No separate lint tool is configured; run typechecks and `git diff --check`.

## Style and tests

Use strict TypeScript, clear domain names, and lowercase hyphenated new filenames.
Keep learning rules in `domain.ts` and pure scheduling rules in `scheduler.ts`.
Keep HTTP/authentication in `index.ts`, routing and atomic retries in `service.ts`,
database access in `store.ts`, and provider transport in `anthropic.ts`.
Match the original scheduler using parity tests.
Never accept a user ID from the browser to choose whose progress to read or write.

Verify meaningful behavior changes, especially:

- A seed bag holds at most 20 words, including concurrent additions.
- A review plants only its rated seed immediately and removes it from the bag.
- Practice never plants words or changes growth; only reviews change growth.
- Learned words remain fully grown and never wilt.
- Reviews stop when there are no new/currently due words.
- Accounts cannot access or overwrite each other's progress.
- Imports preserve source data and never silently replace cloud progress.

## Git and deployment

Use concise imperative commit subjects. PRs describe affected flows and validation;
include screenshots for visual changes. Keep `.env`, server keys, database copies,
and SQL exports out of commits. Public browser configuration is limited to the
Supabase URL and publishable key. Document deployment steps in README.
