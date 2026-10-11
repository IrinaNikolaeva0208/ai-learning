# Testing rules

## Purpose and scope

These rules apply whenever production code, tests, test setup, fixtures, or
verification tooling changes.

## Mandatory rules

- Unit tests MUST use Jest and MUST NOT access a real database, network,
  filesystem outside controlled temporary locations, production credentials, or
  other uncontrolled external state.
- Prisma and external I/O MUST be mocked in unit tests. Tests MUST verify
  behavior and important interactions, not private implementation details.
- Global unit coverage MUST remain 100% for statements, branches, functions,
  and lines after approved exclusions.
- Recognized specs and test-support files MUST compile, lint, format, remain
  type-safe and readable, contain no secrets, and avoid uncontrolled real I/O.
- Shared test-support files MAY have multiple exports and need not have their
  own tests. They MUST NOT be imported by production code.
- E2E tests MUST use the isolated database configured by `.env.test`; they MUST
  NOT touch the development database. Their setup MAY rebuild only that test
  database.
- Background workers MUST be disabled in tests unless a test explicitly starts
  and controls them.
- E2E tests MUST run before handoff or push when changes affect controllers,
  request validation, module wiring, database behavior, migrations,
  configuration loading, background processing, Docker test behavior, or an
  externally observable API contract.
- Pre-commit MUST run staged formatting/fixes, full non-mutating lint, build,
  and unit coverage. It MUST NOT run e2e tests.
- Final handoff MUST report lint, build, coverage, and applicable e2e results.

## Approved coverage exclusions

- Specs and recognized test-support files.
- Nest module metadata files.
- Type-only declaration files.
- Generated code.
- Framework bootstrap files that contain no independently testable behavior.

The only exception for adding another coverage exclusion is explicit user
approval documented in this file.

## Recommended practices

- Tests SHOULD cover success, failure, boundaries, and security-sensitive
  behavior proportionally to risk.
- SQLite raw-query assertions SHOULD account for Prisma returning integers as
  `BigInt`.

## Explicit permanent exceptions

- Jest setup MAY use the export form required by Jest. It still follows every
  other applicable testing and style rule.

## Review checklist

- Are external dependencies controlled or mocked at the correct test level?
- Does unit coverage meet all four 100% thresholds?
- Is the e2e database isolated through `.env.test`?
- Were e2e tests run when the trigger conditions apply?
- Do test helpers stay test-only and satisfy general quality rules?

## Related rules

See [code-style.md](./code-style.md) for test-file exceptions and
[security.md](./security.md) for forbidden test I/O and secrets.
