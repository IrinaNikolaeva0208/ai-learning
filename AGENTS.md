# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bookmark manager REST API — **NestJS 11 + TypeScript**, **Prisma** over **SQLite**, containerised with Docker. Part of an AWS course, but there is **no AWS deployment target** for this project; don't add AWS/Lambda/S3/DynamoDB scaffolding unless asked.

SQLite is the database everywhere — dev, Docker, and tests. There is no Postgres/MySQL variant; Prisma pins the provider per schema file, so don't parameterise it.

The only endpoint so far is `GET /health`, which pings the database: `200 {"status":"ok","database":"up"}` when the query succeeds, `503 {"status":"degraded","database":"down"}` when it fails. Keep it a real failure status — probes and the container healthcheck depend on it.

TypeScript compiles to CommonJS (`module: commonjs` in `tsconfig.json`), but source is written with **ESM syntax** (`import`/`export`), never `require`/`module.exports`. Decorators and `emitDecoratorMetadata` are on — Nest DI depends on them.

## Commands

- Dev server: `npm run start:dev` (watch mode; `npm start` for one-shot, `npm run start:prod` for `dist/`)
- Build: `npm run build` (`nest build` → `dist/`)
- Unit tests: `npm test` (Jest + ts-jest, `*.spec.ts` under `src/`)
- Run a single test by name: `npx jest -t "<test name>"`
- Run one test file: `npx jest src/path/to/file.spec.ts`
- E2E tests: `npm run test:e2e` (`*.e2e-spec.ts` under `test/`, separate config `test/jest-e2e.json`); `npm run docker:test` runs the same suite inside the `api_test` container
- Coverage: `npm run test:cov`
- Lint: `npm run lint` (ESLint flat config `eslint.config.mjs`, type-checked rules; note it runs with `--fix`)
- Format: `npm run format` (Prettier; single quotes, trailing commas)

Jest's `rootDir` is `src/`, so `npm test` does not pick up `test/` — e2e runs only via `npm run test:e2e`.

### Database

- Adding the first model: edit `prisma/schema.prisma`, then `npm run prisma:migrate` (`prisma migrate dev`) — this creates `prisma/migrations/` and regenerates the client.
- Apply existing migrations: `npm run prisma:deploy`. With no migrations present it is a no-op that just creates the database file, which is why container startup works today.
- Regenerate the client only: `npm run prisma:generate` (also runs automatically on `npm install` via `postinstall`).
- Inspect data: `npm run prisma:studio`.
- `npm run db:reset` wipes the dev database. **Prisma refuses destructive commands invoked by an AI agent** (`migrate reset`, `db push --force-reset`) — ask the user to run those, don't work around the guard.

### Git hooks

Husky runs a **pre-commit** hook (`.husky/pre-commit`) on every commit:

1. `npx lint-staged` — ESLint `--fix` then Prettier `--write` over the **staged files only**, with the fixes re-staged automatically (config lives under `"lint-staged"` in `package.json`).
2. `npm test` — the full unit suite.

The hook starts with `set -e`, so a lint error or a failing test aborts the commit before the later steps run. Fix the reported problem rather than reaching for `--no-verify`; if a commit genuinely must bypass the hook, say so explicitly.

Husky installs itself via the `prepare` script on `npm install`. The Docker `development` stage sets `HUSKY=0` because the image has no `.git` — leave it, or `npm ci` prints a spurious warning.

### Docker

Two **independent** compose files — neither is an override of the other, so each is passed on its own and never merged:

- **`docker-compose.yml`** → service `api`, the **development** stack: `development` stage, Nest in watch mode, `src/`, `test/`, and `prisma/` bind-mounted so edits reload without a rebuild. `npm run docker:up` starts it, `npm run docker:down` stops it. Its SQLite file is `./data/dev.db` — a bind mount, not a named volume, so the host can inspect it (`npm run prisma:studio`) and container and host runs share one dev database. The container runs `prisma migrate deploy` before starting.
- **`docker-compose.test.yml`** → service `api_test`, integration tests against a real SQLite database, built from the `development` stage (it needs dev dependencies for Jest and the Prisma CLI). `npm run docker:test` runs it (`docker compose -f docker-compose.test.yml run --rm --build api_test`) and it exits when the suite finishes; `npm run docker:test:down` drops its volume. It bind-mounts `src/`, `test/`, and `prisma/` so it tests current sources without a rebuild, and uses its own `sqlite-test-data` volume — it never touches the `api` container's data.

Any `docker compose` command aimed at the test service needs `-f docker-compose.test.yml`; the bare command only sees `api`.

**Neither compose file is a production deployment.** The production image is the Dockerfile's `runtime` stage — the default target, so `docker build -t bookmark-manager .` produces it. Nothing in the repo runs it; add a deployment config when there is somewhere to deploy to.

The `Dockerfile` is staged `base → development → build → runtime`. Points that are easy to break:

- The schema is copied **before** `npm ci` because the `postinstall` hook runs `prisma generate` and needs it.
- `HUSKY=0` in the `development` stage — the image has no `.git`, so husky's `prepare` hook would warn.
- Both `development` and `runtime` run as the unprivileged `node` user (uid 1000), which matches the host user, so files written through the `./data` bind mount are host-owned rather than root-owned.
- `data/` is tracked via `data/.gitkeep`. It must exist before `docker compose up`: Docker creates a missing bind-mount source as **root**, and the container then cannot write its database.
- The dev command passes `--no-shell` to `nest start --watch`. Without it the CLI spawns node behind a `sh -c` wrapper, and on reload it kills the wrapper but orphans node, so the restart dies with `EADDRINUSE`.

## Conventions

- Generate new pieces with the Nest CLI (`npx nest g module bookmarks`, `g controller`, `g service`) so structure and spec files stay conventional.
- One feature = one module directory under `src/` (`src/bookmarks/` with `bookmarks.module.ts`, `.controller.ts`, `.service.ts`, `dto/`).
- Database access goes through `PrismaService` (`src/prisma/prisma.service.ts`), injected into services. `PrismaModule` is `@Global()`, so feature modules need not import it.
- Validate request payloads with `class-validator` DTOs. The global `ValidationPipe` in `src/main.ts` runs with `whitelist`, `forbidNonWhitelisted`, and `transform` on, so DTO fields must be decorated or they are stripped/rejected.
- Config comes from `@nestjs/config` (`ConfigModule.forRoot({ isGlobal: true })`); read env via `ConfigService`, not bare `process.env`.
- **`DATABASE_URL` is relative to `prisma/`, not the repo root** — hence `file:../data/dev.db` for a file at `data/dev.db`. Copy `.env.example` to `.env` for local runs.
- Unit tests mock `PrismaService` with a plain object provider (see `src/app.controller.spec.ts`); they must not touch a real database. E2E tests use a real one: `.env.test` points every process at `data/test.db`, and `test/setup-e2e.ts` deletes and rebuilds it with `prisma db push`, so e2e never touches `data/dev.db`.
- Prisma returns SQLite integers from `$queryRaw` as `BigInt` (`1n`, not `1`) — matters when asserting on raw results.
- ESLint uses `recommendedTypeChecked`, so lint errors can be type errors — fix them rather than casting to `any`.
- Formatting runs automatically via a Prettier format-on-edit hook (`.claude/settings.json`) on JS/TS/JSON files.
- Default branch is `main`. Branch off `main` for changes; only commit/push when asked.

## Skills

Skills shared by both agents live in **`.agents/skills/<name>/SKILL.md`** — the vendor-neutral location Codex reads, mirroring how `CLAUDE.md` is a symlink to `AGENTS.md`. Claude Code only scans `.claude/skills/`, so each shared skill gets a directory there whose `SKILL.md` is a **symlink** into `.agents/skills/`:

```
.agents/skills/grilling/SKILL.md          # real file, edit here
.claude/skills/grilling/SKILL.md -> ../../../.agents/skills/grilling/SKILL.md
```

Symlink the `SKILL.md`, not the skill directory: a real directory with a symlinked file is discovered by both agents regardless of whether their globs follow symlinked directories, which is not guaranteed. Codex-specific presentation (display name, whether the model may invoke the skill on its own) goes in `agents/openai.yaml` next to the `SKILL.md`; Claude reads the equivalent from the SKILL.md frontmatter (`disable-model-invocation`).

Currently shared: `grilling` and its user-invoked entry point `grill-me` (vendored from [mattpocock/skills](https://github.com/mattpocock/skills), MIT). `verify` is Claude-only and lives directly in `.claude/skills/`; move it under `.agents/skills/` with a symlink if Codex should get it too.

Check what Codex actually sees with `codex debug prompt-input | grep -o '<skills_instructions>.*</skills_instructions>'` — skills with implicit invocation disabled are deliberately absent from that list and reachable only as a slash command.
