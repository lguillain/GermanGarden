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

- **Garden:** each planted topic is a raised patch of land, with one plant per word. Select a patch for a closer view, then select a plant to see its vocabulary and growth. Reviews grow plants through six stages; learned words display mature trees. A word belonging to several topics appears in each relevant patch, sharing the same progress. All planted levels remain visible. The seed bag, unexplored topics, and progress totals expand on demand.
- **Find words:** topic selection sits on the left, the word card in the centre, and the seed bag on the right. Selecting a topic applies immediately; expand “Describe a situation” for free-text guidance. Keep, set aside, or mark known words using the original adaptive feed logic.
- **Seed bag:** practise new words without changing progress; rating a seed in Review plants it automatically. A bag holds up to 20 seeds; review one to make room when full.
- **Review:** reveal the meaning and grade Again / Hard / Good / Easy to update the existing spaced-repetition scheduler. The original app also permits early reviews.
- **Practice:** flashcards, conversation, reading, and grammar. The original flashcard “Learned” action is preserved and counts the word as fully grown.
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

The existing Python app takes precedence when it differs from `vocab-garden-ux.md`. `AGENTS.md` has been left unchanged.
