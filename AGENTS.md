# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains the product specification for Vocab Garden, a German vocabulary web app. `vocab-garden-ux.md` defines terminology, word states, and user flows. Read it before proposing implementation or changing behavior.

There are no source, test, or asset directories yet. When adding the application, establish clear locations for these components and update this guide with the actual structure. Keep product decisions in the UX document rather than scattering them across implementation notes.

## Build, Test, and Development Commands

No build system, package manifest, development server, or automated test runner is configured. There are currently no build or test commands to run.

When introducing tooling, document the exact install, local development, build, lint, and test commands here. Ensure each command works from the repository root.

## Coding Style & Naming Conventions

For Markdown, use descriptive headings, short paragraphs, hyphenated bullet lists, and tables for comparable states or terms. Use lowercase, hyphen-separated filenames, following `vocab-garden-ux.md`.

No programming language, formatter, or linter has been selected. Establish language-specific conventions alongside the first implementation. Reuse the specification's domain terms consistently: seed bank, seed bag, garden, practice, and review.

## Testing Guidelines

No testing framework or coverage threshold exists yet. Documentation changes should be checked for clear wording and consistency with the UX specification.

When implementing behavior, test these core rules:

- A seed bag holds at most 20 words and plants automatically when full.
- Practice never changes growth stages; reviews do.
- Learned words remain fully grown.
- Planting empties the seed bag and places words under their topics.

Document test locations, naming conventions, and execution commands when tests are introduced.

## Commit & Pull Request Guidelines

No Git metadata or commit history is available in this checkout, so no existing commit convention can be inferred. Use concise, imperative commit subjects, such as `Clarify seed bag planting behavior`.

Pull requests should explain the change, identify affected user flows, link relevant issues when available, and describe validation performed. Include screenshots for visual changes. Update the UX specification whenever intended product behavior changes.
