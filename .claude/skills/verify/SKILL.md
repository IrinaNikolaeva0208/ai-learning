---
name: verify
description: Verify changes to the bookmark-manager by running the project's build, test suites, and lint. Use before committing non-trivial changes.
---

Verify the current changes end-to-end for this NestJS + TypeScript project.

1. If there is no `package.json` yet, tell the user there's nothing to verify and stop.
2. Type-check and build: `npm run build`.
3. Run the unit tests: `npm test`.
4. Run the e2e tests: `npm run test:e2e` (separate Jest config; `npm test` does not cover `test/`).
5. Run lint: `npm run lint`. Note it runs with `--fix`, so it may modify files — mention any files it rewrote.
6. Report results plainly: what passed, what failed, and the failing output. Do not claim success if anything failed.

This is additive to Claude Code's built-in `/verify` — it pins the exact commands for this repo.
