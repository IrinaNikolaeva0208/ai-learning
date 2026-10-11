# Security rules

## Purpose and scope

These rules apply to input, output, authentication, dependencies, secrets,
files, processes, and network access.

## Mandatory rules

- Request payloads MUST use decorated `class-validator` DTOs. Global validation
  MUST keep `whitelist`, `forbidNonWhitelisted`, and `transform` enabled.
- Secrets and credentials MUST NOT be committed, logged, returned in errors, or
  embedded in URLs. Example environment files MUST contain safe placeholders.
- Runtime configuration MUST be read through `ConfigService` and validated or
  parsed at its boundary.
- Outbound HTTP MUST allow only required protocols and ports; reject URL
  credentials; resolve and validate every destination; block private, loopback,
  link-local, reserved, multicast, and otherwise non-public addresses; pin the
  validated destination; and repeat validation after every redirect.
- Outbound HTTP MUST enforce timeouts, redirect limits, response-size limits,
  expected content types, and safe error handling. Stored or returned URLs MUST
  have credentials removed.
- Unit tests MUST mock network access. E2E tests MUST NOT call arbitrary real
  external services.
- A new dependency MUST be justified, placed in the correct dependency group,
  locked, reviewed for security and license risk, and covered by relevant tests.
- A change MUST NOT introduce a new high or critical production advisory
  without explicit user approval documented in this file.
- Agents MUST NOT run forced audit fixes or unapproved major dependency upgrades.
- Security fixes MUST receive regression tests appropriate to the risk.

## Recommended practices

- Prefer platform APIs or existing dependencies when they meet the requirement.
- Error messages SHOULD be useful without exposing internals or remote content.

## Explicit permanent exceptions

- Bootstrap code, configuration factories, Jest setup, and repository scripts
  MAY read `process.env` where `ConfigService` is unavailable. They MUST parse
  or validate values at that boundary and MUST NOT spread unfiltered environment
  data into child processes unless the controlled tool requires it.
- Advisories already present on the adoption baseline are not considered newly
  introduced. They MUST NOT increase in severity or scope, and dependency work
  SHOULD reduce them. This exception does not authorize ignoring a directly
  exploitable advisory.

## Review checklist

- Are inputs validated and outputs free of secrets?
- Does outbound HTTP resist SSRF, redirects, oversized bodies, and hangs?
- Are dependency additions necessary, locked, audited, and tested?
- Did the change avoid new high or critical production advisories?
- Do security-sensitive fixes have regression coverage?

## Related rules

See [testing.md](./testing.md) for controlled I/O and
[operations.md](./operations.md) for runtime configuration.
