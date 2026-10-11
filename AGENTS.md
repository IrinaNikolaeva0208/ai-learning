# Project instructions

This is the mandatory, vendor-neutral entry point for humans and coding agents.
`CLAUDE.md` is a symlink to this file so Claude and Codex receive the same
project guidance.

## Project

Bookmark manager REST API built with NestJS 11, TypeScript, Prisma, and SQLite,
and containerized with Docker. It exposes health and bookmark CRUD endpoints and
enriches bookmarks with asynchronously fetched page metadata.

This is part of an AWS course, but it has no AWS deployment target. Do not add
Lambda, S3, DynamoDB, or other deployment scaffolding unless asked. SQLite is
the database in development, Docker, and tests; do not parameterize Prisma's
provider.

TypeScript compiles to CommonJS, while application source uses ESM
`import`/`export` syntax. Decorators and emitted metadata are required by Nest
dependency injection.

## Mandatory rule loading

Before changing or reviewing application code, read:

- [architecture.md](.agents/rules/architecture.md)
- [code-style.md](.agents/rules/code-style.md)

Also read every rule document applicable to the work:

- [mapping.md](.agents/rules/mapping.md) for controllers, services,
  repositories, DTOs, integrations, or representation changes.
- [testing.md](.agents/rules/testing.md) whenever production code, tests, test
  setup, fixtures, or verification tooling changes.
- [security.md](.agents/rules/security.md) for input, output, authentication,
  dependencies, files, processes, configuration, or network behavior.
- [database.md](.agents/rules/database.md) for Prisma, schemas, migrations,
  repositories, transactions, or database configuration.
- [operations.md](.agents/rules/operations.md) for configuration, Docker,
  health checks, workers, startup, shutdown, or deployment.
- [git-workflow.md](.agents/rules/git-workflow.md) before branch, commit, push,
  or pull-request operations.

Reviews MUST load the rules governing the reviewed files. Each rule has one
authoritative home; follow its cross-references instead of inventing a duplicate.
Higher-priority platform and user instructions override repository guidance.
The closest applicable `AGENTS.md` overrides this root file. If repository rules
still conflict, stop and ask the user.

Only the user may approve an exception. Agents may propose one but cannot
approve it. If `.agents/rules/temporary-exceptions.md` exists, agents may commit
locally but MUST NOT push or create a pull request.

## Commands

- Development: `npm run start:dev`; one-shot: `npm start`; built app:
  `npm run start:prod`.
- Build: `npm run build`.
- Fix lint: `npm run lint`; verify without changes: `npm run lint:check`.
- Unit tests: `npm test`; coverage: `npm run test:cov`.
- One unit file: `npx jest src/path/to/file.spec.ts`; one test:
  `npx jest -t "<test name>"`.
- E2E: `npm run test:e2e`; Docker E2E: `npm run docker:test`.
- Format: `npm run format`.

Jest's unit `rootDir` is `src/`; it does not discover `test/*.e2e-spec.ts`.

## Database

- Create a development migration after editing the schema:
  `npm run prisma:migrate`.
- Apply existing migrations: `npm run prisma:deploy`.
- Regenerate the client: `npm run prisma:generate`.
- Inspect development data: `npm run prisma:studio`.
- `DATABASE_URL` is relative to `prisma/schema.prisma`, so
  `file:../data/dev.db` addresses `data/dev.db`.
- `npm run db:reset` destroys the development database. Agents must not run it,
  `prisma migrate reset`, `prisma db push --force-reset`, or equivalent
  destructive commands; ask the user to run the exact command.

Unit tests mock Prisma. E2E uses the isolated database from `.env.test`, and
`test/setup-e2e.ts` rebuilds only that database. Prisma raw SQLite integers are
returned as `BigInt`.

## Git hooks

Husky pre-commit runs, in order:

1. `npx lint-staged`
2. `npm run lint:check`
3. `npm run build`
4. `npm run test:cov`

The hook aborts on failure. Do not use `--no-verify` without explicit prior user
approval. Husky installs through `prepare`; Docker sets `HUSKY=0` because image
builds have no `.git` directory.

## Docker

The Compose files are independent and must never be merged:

- `docker-compose.yml` runs development service `api` with watch-mode bind
  mounts and `data/dev.db`. Use `npm run docker:up` and `npm run docker:down`.
- `docker-compose.test.yml` runs service `api_test` against its isolated SQLite
  volume. Use `npm run docker:test` and `npm run docker:test:down`.

Neither file is production deployment. The Dockerfile's default `runtime` stage
builds the production image, but no deployment target consumes it.

Preserve these invariants:

- Prisma schema is copied before `npm ci`, because `postinstall` generates the
  client.
- Development and runtime stages execute as the unprivileged `node` user.
- `data/.gitkeep` keeps the bind-mount source present and host-writable.
- Development uses `nest start --watch --no-shell` to avoid orphan processes on
  reload.

## Universal completion checklist

- Applicable rule documents were read and followed.
- The change respects module ownership and representation boundaries.
- Inputs, outputs, dependencies, configuration, and network behavior were
  reviewed for security impact.
- `npm run lint:check`, `npm run build`, and `npm run test:cov` pass.
- E2E tests pass when required by `testing.md`.
- Schema changes include a migration and ownership-table review.
- No temporary-exceptions file exists before an agent pushes or creates a PR.
- Commit, push, and PR actions occur only when requested.

## Shared skills

Shared skills live at `.agents/skills/<name>/SKILL.md`. Claude discovers them
through a real `.claude/skills/<name>/` directory whose `SKILL.md` symlinks to
the shared file. Symlink the file, not the skill directory. Codex-specific skill
presentation belongs in `agents/openai.yaml`; Claude reads SKILL frontmatter.

Currently shared: `grilling` and its `grill-me` entry point. `verify` remains
Claude-only under `.claude/skills/`.
