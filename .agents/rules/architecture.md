# Architecture rules

## Purpose and scope

These rules define Nest module boundaries, dependency direction, aggregate
ownership, and cross-module coordination. They apply to all application code.
The terms MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are normative.

## Mandatory rules

- `AppModule` MUST be composition-only. It may import modules and global
  configuration, but MUST NOT own controllers or providers.
- Each feature MUST live in a focused Nest module. A feature module MAY contain
  controllers, application services, mapper services, repositories, and
  feature-specific infrastructure.
- Dependencies MUST flow as follows:
  `Controller -> own Application Service -> Mapper / own Repository / exported Foreign Service`.
- Controllers MUST call only application services owned by their module.
- Repositories MUST depend only on infrastructure such as `PrismaService` and
  MUST NOT call services or other repositories.
- Mapper services MUST be stateless and MUST NOT depend on repositories,
  Prisma, configuration, networking, clocks, or mutable state.
- A feature module MUST export only application services that intentionally
  form its public API. It MUST NOT export controllers, repositories, mappers,
  or internal services.
- A repository MUST directly access only Prisma models owned by its module.
  Nested writes, raw SQL, cascades, and direct use of `PrismaService` MUST NOT
  bypass ownership.
- Cross-module reads and writes MUST use the owning module's exported service.
- A cross-module operation that must be atomic MUST use the shared Unit of Work
  abstraction. Feature APIs receive an opaque transaction context, never a raw
  Prisma transaction client. A coordinator MUST still call public services and
  MUST NOT bypass repositories.
- Shared code MUST be stateless and domain-agnostic. It MUST NOT contain
  feature repositories, feature models, or feature workflows. Infrastructure
  MAY wrap Prisma, configuration, logging, clocks, identifiers, and Unit of
  Work behavior. Infrastructure MUST NOT depend on features.
- Code MUST NOT be moved to a shared directory merely to avoid a module
  boundary.

## Aggregate ownership

| Prisma model       | Owning module     | Notes                        |
| ------------------ | ----------------- | ---------------------------- |
| `Bookmark`         | `BookmarksModule` | Aggregate root               |
| `BookmarkMetadata` | `BookmarksModule` | Required child of `Bookmark` |

A schema change that adds or transfers a Prisma model MUST update this table in
the same change.

## Recommended practices

- Modules SHOULD expose the smallest public service contract possible.
- Circular dependencies and `forwardRef` SHOULD be treated as signals to
  revisit ownership or orchestration.

## Explicit permanent exceptions

There are no permanent exceptions.

## Review checklist

- Is `AppModule` composition-only?
- Does each dependency follow the permitted direction?
- Are repositories and mappers private to their module?
- Does every Prisma model have exactly one documented owner?
- Do cross-module operations use public services and, when needed, Unit of Work?

## Related rules

See [database.md](./database.md) for Prisma practices and
[mapping.md](./mapping.md) for representation boundaries.
