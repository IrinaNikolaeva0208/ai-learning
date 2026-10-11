# Operations rules

## Purpose and scope

These rules cover configuration, startup, health checks, background workers,
Docker, and deployment artifacts.

## Mandatory rules

- The health endpoint MUST return HTTP 200 with database `up` after a successful
  probe and HTTP 503 with database `down` after a failed probe. Container and
  platform probes depend on the failure status.
- Runtime configuration MUST use the global Nest config module and
  `ConfigService`, subject to the bootstrap exceptions in
  [security.md](./security.md).
- Background workers MUST have explicit enablement behavior, bounded work per
  run, graceful shutdown, retry limits, and safe concurrency controls. Tests
  MUST disable them unless explicitly controlled.
- `docker-compose.yml` and `docker-compose.test.yml` MUST remain independent;
  they MUST NOT be treated as a base/override pair.
- Docker builds MUST preserve Prisma schema availability before `npm ci`,
  `HUSKY=0` in the development image, unprivileged runtime users, and ownership
  compatible with bind-mounted data.
- The tracked `data/` directory MUST continue to exist so Docker does not create
  the bind source as root.
- Development watch startup MUST retain the process behavior that prevents
  orphaned Nest processes and `EADDRINUSE` reload failures.
- Compose configurations MUST NOT be described as production deployment.
  Deployment-specific infrastructure MUST be added only for an actual target
  requested by the user.

## Recommended practices

- Worker timing and limits SHOULD be named constants with explicit units.
- Shutdown paths SHOULD finish or safely release in-flight work.

## Explicit permanent exceptions

There are no permanent exceptions.

## Review checklist

- Do health failures remain visible to probes?
- Are configuration and worker lifecycle behavior explicit and tested?
- Do Docker stages preserve Prisma generation and non-root execution?
- Are development and test Compose commands using the correct file?
- Has unsupported deployment scaffolding been avoided?

## Related rules

See [security.md](./security.md) for configuration and network safety and
[testing.md](./testing.md) for worker and Docker test behavior.
