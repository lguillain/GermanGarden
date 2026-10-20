# Vocab Garden

A local German vocabulary app with a React + TypeScript interface and a Python/FastAPI backend. The interface uses English controls and a fixed isometric garden inspired by Forest’s soft miniature worlds. The interactive garden artwork is drawn with SVG, so it stays sharp without a separate 3D engine or downloaded image assets.

## Run locally

The local Python environment and copied vocabulary/profile databases have been prepared in this checkout.

```bash
./scripts/dev.sh
```

Open **http://127.0.0.1:5173**. Select your existing learner profile or create a new one. The backend listens on `127.0.0.1:8000`; Vite forwards `/api` requests to it.

For a fresh environment (Node 22 and Python 3.10+ recommended):

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm ci
./scripts/dev.sh
```

Vocabulary data must exist at `data/vocab.sqlite`. This checkout includes a local copy from GermanMatch; data and learner databases are excluded from version control. Existing profiles live in `data/profiles/`. These are independent copies: changes here do not sync back to GermanMatch.

## Learning flow

- **Garden:** each planted topic is a raised patch of land, with one plant per word. Select a patch for a closer view, then select a plant to see its vocabulary and growth. Reviews grow plants through six stages; learned words display sunflowers. A word belonging to several topics appears in each relevant patch, sharing the same progress. All planted levels remain visible. The seed bag, unexplored topics, and progress totals expand on demand.
- **Find words:** topic selection sits on the left, the word card in the centre, and the seed bag on the right. Selecting a topic applies immediately; expand “Describe a situation” for free-text guidance. Keep, set aside, or mark known words using the original adaptive feed logic.
- **Seed bag:** practise new words without changing progress; rating a seed in Review plants it automatically. A bag holds up to 20 seeds; review one to make room when full.
- **Review:** reveal the meaning and grade Again / Hard / Good / Easy to update the existing spaced-repetition scheduler. Review finishes when no new or currently due words remain.
- **Practice:** flashcards, conversation, reading, and grammar. Practice does not change growth or planting.
- **Profiles:** use the name button in the header to switch learners. New profiles choose a level before learning.

AI guidance, conversations, reading, and grammar use the existing Anthropic integration. The local `.env` configuration was copied from GermanMatch without changing the original. For a fresh setup, copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. Standard discovery, flashcards, and reviews work without AI. Keys stay on the Python server.

## Build and verify

```bash
npm run build
.venv/bin/python -m unittest discover -s tests -v
```

API tests use temporary database copies and mock AI calls, so they do not change your profiles or spend API credits.

Browser flow checks (requires Playwright Chromium and permission to open a local port):

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

The browser test server also uses disposable profiles and disables AI calls.

After building, serve the full app with one process:

```bash
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Then open **http://127.0.0.1:8000**. Restart that process after rebuilding frontend assets.

## Code layout

- `frontend/src/`: React screens, API types, and plain CSS.
- `app/main.py`: JSON API and built frontend serving.
- `app/{feed,garden,learn,onboarding}.py`: learning logic carried over from GermanMatch.
- `app/practice.py`: scoped practice and flashcard selection.
- `pipeline/`, `schema.sql`, `activities.yaml`: original vocabulary pipeline and schema. Raw pipeline inputs are not duplicated here.
- `tests/`: API integration tests using Python’s built-in unittest runner.

Product behavior is documented in `vocab-garden-ux.md`; repository commands and conventions are in `AGENTS.md`.

### Frontend structure

- `main.tsx`: mounts React, query providers, and the router.
- `app.tsx`: route definitions; `app-shell.tsx`: session, navigation, and sign-out.
- `pages/home/`: home page and its interactive garden view.
- `pages/explore/`: Explore page and its topic list.
- `pages/topic/`: topic page, scope links, and its selectable plot view.
- `pages/practice/`: practice menu, flashcards, conversation, reading, and grammar,
  together with their layout, corrections, query hook, and route wrapper.
  Each practice page owns its state and API mutations.
- Other `pages/` files: self-contained discovery, review, login, and profile flows.
- `components/`: UI used across page groups—word cards, seed bag, topic progress,
  feedback, word-set switch, and the shared SVG artwork.
- `hooks/`: shared word-set selection, topic-name queries, and startup prefetching.
- `queries/`: query options shared by garden pages and startup prefetching.
- `api.ts`, `supabase.ts`, `query-client.ts`: HTTP/auth clients and query configuration.

Keep page-specific state, components, and hooks alongside their page. Promote
code to a shared folder when another page group actually needs it.
The AI practice route resets its page when the selected word set changes; the
shared practice layout handles loading, errors, and empty sets without owning
conversation or exercise state.

Run `npm run format:frontend` after frontend changes. The deployment workflow
checks formatting with `npm run check:format:frontend`.

### Reading the cloud backend

Start with `supabase/functions/garden/domain.ts` for the learning flows:
`scope` chooses the word set, `reviewWords` checks eligibility, `grade` updates
the schedule and plants the rated seed, and `swipe` records a seed-bank decision.
`scheduler.ts` contains the pure growth-stage and rating calculations, checked
against the Python scheduler. Practice reads these rules without changing growth.

The request flow is `index.ts` → `service.ts` → `domain.ts`.
`index.ts` verifies the learner and chooses the data-loading path;
`service.ts` routes requests and retries atomic writes against fresh progress;
`store.ts` implements database reads and writes. The learner ID always comes
from verified authentication. `ai.ts` handles practice and guidance, while
`anthropic.ts` only handles the external API transport.

Review GET has a smaller read path: `load_review_selection` selects one card and
counts in PostgreSQL, and `reviewSelectionResponse` uses the same domain card
formatting and scheduler as review POST. The SQL/domain parity tests cover both
paths. Changes to review eligibility or ordering must keep them consistent.

Run `npm run format:cloud` after editing cloud TypeScript.
`npm run check:format:cloud` checks formatting without changing files and also
runs in the deployment workflow.

## Supabase + GitHub Pages

The cloud version serves the static React app on GitHub Pages and runs the API in
`supabase/functions/garden/`. Supabase Auth provides email/password login;
PostgreSQL holds shared vocabulary and private progress. The original Python app
still works when the frontend has no Supabase environment variables.

For this private garden, accounts are created by the owner. There is no public
signup screen. Disable **Allow new users to sign up** in the hosted Supabase Auth
settings before publishing; the local configuration already disables signup.

### Local cloud development

Requires Node 22+, Python 3, Docker and the Supabase CLI. From the repository root:

```bash
npm ci
supabase start
supabase functions serve garden
```

The project uses its own ports to coexist with other local Supabase projects:
API `http://127.0.0.1:55321`, database `55322`, Studio `55323`.
Configure the frontend automatically in another terminal:

```bash
npm run configure:local
```

This creates `.env.local` using the local Supabase URL and public key, preserving
unrelated settings. It never copies the service-role key. Then run `npm run dev`.
Restart Vite if it was already running.

Import **all local profiles, vocabulary and progress** in one command:

```bash
npm run import:local
```

This reads every `data/profiles/*.sqlite` database, creates a local login account
for each profile, and imports all data in one transaction. No manual UUID mapping
or account creation is needed. Accounts use addresses such as
`leo@vocab-garden.test`. Their generated passwords are saved in
`data/local-supabase-accounts.json` (private and ignored by Git). No email is sent.
Sign in with the profile username (for example, `leo`) and its password; you do not
need to type the full address. Full email addresses are also accepted.

The importer only connects to this project's **local** Supabase instance. It does
not change your SQLite files. Rerunning it reuses accounts and preserves existing
Supabase progress and passwords, so later reviews are not overwritten. New
profiles are added. If a run is interrupted, rerun the same command. The generated
SQL and account mapping are saved under ignored `data/` for recovery.

For optional local AI, copy `supabase/.env.example` to `supabase/.env`, fill in the
Anthropic key and run `supabase functions serve garden --env-file supabase/.env`.
Keep this file private. The Edge Function caches vocabulary for up to five minutes
after imports.

### Create the hosted backend

1. Create a Supabase project, choose a nearby region, and keep its database password.
2. Run `supabase login`, then `supabase link --project-ref YOUR_PROJECT_REF`.
3. Run `supabase db push` to apply the migration, then disable public signup in Auth.
4. Create your two accounts in Authentication → Users with confirmed emails and
   passwords. Their UUIDs identify which existing profile belongs to each account.
5. Export each profile, supplying the corresponding account UUID:

```bash
python3 scripts/export-supabase.py --profile data/profiles/leo.sqlite --user-id ACCOUNT_UUID --output data/supabase-leo.sql
```

Run the generated SQL against the hosted database using `psql`, with the session
pooler connection details from Supabase's **Connect** dialog (use `-W` to enter the
password interactively), or the SQL Editor for small exports. The file imports
vocabulary plus progress in one transaction. Repeat with the other profile and
its account UUID. Import **before the first app login**, because the app creates
an empty progress record on first access. An existing progress record makes the
import fail; it never silently replaces cloud progress. Local databases are read
only and remain unchanged. Export files contain private data and belong under
ignored `data/`, never in the public repository.

6. Set the function secrets from a private file:

```bash
supabase secrets set --env-file supabase/.env
supabase functions deploy garden
```

Set `ALLOWED_ORIGINS` to the exact site origin, for example
`https://YOUR_USERNAME.github.io` (without the repository path). Add a custom
origin if using a custom domain. `ANTHROPIC_API_KEY` is optional; without it,
flashcards, discovery and reviews work, but AI practice is unavailable.
The function validates each user token through Supabase Auth before accessing
any data, including when gateway JWT verification is disabled in the config.
Vocabulary is cached for five minutes per function instance; concurrent requests
share a catalogue load. Instance reuse is an optimization, not a requirement:
each cold load uses one `load_garden_catalog` database call. Topic lists fetch only
their topic's words and no sentences. Session reads only the learner name and
level, plus the AI availability flag; `/activities` separately returns cached
topic IDs and names when a page needs them. The garden skips sentences too.
The practice menu, Reading, and Conversation call `/practice/summary`, backed by
`load_practice_summary`, which counts seeds/plants without loading word details
or scheduling history. Grammar uses `/practice`: it reads kept progress and
then only those words from `load_practice_catalog`, without sentences. That
learner-specific catalogue is never cached between accounts. Signed-in garden
and practice pages prefetch their data alongside session bootstrap and reuse
the same query on mount. Browser queries stay fresh for 30 seconds; keep/review
mutations invalidate the affected counts and word lists.
Flashcards still load example sentences when opened.
Review GET requests use `load_review_selection` instead: one database snapshot
selects the next eligible word, one example sentence, and review counts. They
skip the full catalogue and progress loaders, and never cache learner results.
Rating previews still use the TypeScript scheduler; review POST writes retain
their existing atomic version checks.
Vocabulary imports can take up to five minutes to appear
in an existing instance. Learner progress is never cached. Timer heartbeats skip
catalogue loading entirely. Responses include `Server-Timing` durations for
authentication, catalogue loading, progress reads, dispatch, saves, and explicit
AI calls, where applicable. Ordinary discovery does not invoke AI; free-text
guidance and AI practice still do.
Review GET exposes `auth`, `review`, and `dispatch` timings; `dispatch` includes
the `review` query duration, so these two values should not be added together.

Deploy backend performance changes with
`supabase functions deploy garden`; publishing GitHub Pages alone does not update
the backend. Apply pending database migrations first with `supabase db push`.

### Publish the frontend

1. Create a GitHub repository and push this project. GitHub Free Pages requires a
   public repository; only source code and built browser assets belong there.
2. In repository **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_SUPABASE_URL`: your hosted project URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: the public publishable key (legacy anon keys
     also work). Never put a service-role or Anthropic key here.
3. In **Settings → Pages**, choose **GitHub Actions** as the source.
4. Run **Deploy GitHub Pages** from the Actions tab. Deployment is deliberately
   manual so code pushes do not publish unfinished changes.

The workflow tests the cloud logic and browser login/loading flows, builds with the correct repository base path,
and publishes `dist/`. Routes use `/#/…` so direct navigation and refresh work on
GitHub Pages. No Python server is needed in production. Supabase functions and
migrations are deployed separately with the CLI commands above.

### Cloud verification

```bash
npm run check:cloud
npm run test:cloud
npm run build
```

Test frontend sign-in, farmer-icon logout, and account switching with mocked
Supabase responses (requires Playwright Chromium; no cloud accounts are used):

```bash
npx playwright test --config playwright.cloud.config.ts
```

The cloud logic tests run without Docker or network access, using embedded PostgreSQL for
migration/RLS tests. They cover scheduler parity with Python, all planting ratings,
practice immutability, review completion, learned words, concurrent writes and
account isolation. With `supabase start` and `supabase functions serve garden`
running, also run:

```bash
node --import tsx tests/cloud/local-integration.ts
# Also verify the built site on a GitHub-style repository subpath:
node --import tsx tests/cloud/local-integration.ts --browser
```

This uses only the dedicated local stack, creates temporary accounts and vocabulary,
checks real Auth/API/RLS behavior, and removes its fixtures. It does not call AI. The browser variant needs Playwright Chromium (`npx playwright install chromium`), builds into ignored `dist-cloud/`, and writes screenshots to `test-results/`.

Learner data lives in typed relational tables: `learner_profiles`,
`learner_decisions`, `learner_word_marks`, `learner_srs`,
`learner_topic_weights`, `learner_reviews`, and `learner_sessions`.
Ordinary requests load current progress and time totals, not review or session
history. Writes send only changed rows and append new reviews. Atomic version
checks recheck seed-bag capacity and review eligibility on conflicts. Heartbeats
update session rows separately without invalidating review versions. All learner
tables enforce per-account reads, and only the backend can call write functions.
JSON is used for RPC transport, not persisted as a learner document.

### Upgrade an existing JSON-based deployment

For the slim session and practice startup, apply
`202610200007_practice_summary.sql`, deploy the garden function, and publish the
matching frontend. This change requires both backend and frontend updates:
topic names now come from `/activities`, and practice counts from
`/practice/summary`.

For the scoped topic/practice reads, apply
`202610200006_scoped_progress.sql` with `supabase db push` before running
`supabase functions deploy garden`. This additive migration also adds indexes
for seed-bag and learned-word lookups. Partial read snapshots are never used for
progress writes; no frontend deployment is required for this optimization.

The `202610200001_normalize_learners.sql` migration copies and validates all learner
collections and versions, then removes `learner_state` and its old write function.
It runs in one transaction and locks the old table during the transfer. A failed
validation rolls back the entire migration. No JSON archive remains in the database.

1. Ask users to pause learning during the brief backend upgrade. Save independent
   backups under ignored `data/` with private permissions:

   ```bash
   umask 077
   supabase db dump --linked --schema public --file data/before-normalization-schema.sql
   supabase db dump --linked --schema public --data-only --file data/before-normalization-data.sql
   ```

2. Run the cloud checks above and test locally with `supabase migration up --local`,
   the updated garden function, and `tests/cloud/local-integration.ts`.
3. Apply the migration and immediately deploy the matching backend:

   ```bash
   supabase db push --linked
   supabase functions deploy garden
   ```

4. Confirm sign-in, garden, review, and time tracking. Publishing GitHub Pages is
   not required for this backend-only change. Do not redeploy an older garden
   function: it requires the removed JSON table. Regenerate any old import SQL
   with the updated exporter before running it.

If migration fails, keep the old backend and inspect the validation error. If the
backend deployment fails after migration, retry deployment of this version; do not
reset the database or re-import progress. Keep the independent backups private.

### Matcher latency upgrade

`202610200004_matcher_progress.sql` adds compact matcher reads and atomic,
append-only decision writes. Existing full-progress readers and writers remain
compatible. Apply this migration before deploying the updated garden function:

```bash
supabase db push --linked
supabase functions deploy garden
```

Publish the frontend through the existing GitHub Pages workflow to enable next-card
previews. Each response includes a preview for each available decision. The browser
shows that card while saving, disables further decisions until confirmation, and
restores the previous card on failure. Seed bag changes appear only after confirmation.
Older frontends can still use the updated API, and the updated frontend tolerates
responses without previews. Server-Timing exposes `auth`, `progress`, `catalog`,
`dispatch`, and `save` durations for checking actual request latency.

### Review read latency upgrade

Apply `202610200005_review_selection.sql` before deploying the updated function:

```bash
supabase db push --linked
supabase functions deploy garden
```

The migration adds a backend-only read function and preserves existing data and
write functions. No frontend deployment is needed. Compare the GET `/review`
request's total duration and `Server-Timing` header before and after deployment;
the new path reports `review` instead of full `catalog` and `progress` reads.
