# Database rules

## Purpose and scope

These rules govern Prisma, SQLite, schemas, migrations, repositories, and data
safety.

## Mandatory rules

- SQLite MUST remain the database for development, Docker, and tests unless the
  user explicitly changes the project requirement. The provider MUST NOT be
  parameterized.
- Database access MUST go through a repository owned by the appropriate feature
  module. Repositories MAY depend on `PrismaService`; application services and
  controllers MUST NOT query Prisma directly.
- Repository model access MUST follow the ownership table in
  [architecture.md](./architecture.md).
- Every schema change MUST include its migration, regenerated client artifacts
  when applicable, ownership-table review, and relevant tests.
- Existing migrations MUST be applied with `prisma migrate deploy` in managed
  startup flows. Development migrations MUST use `prisma migrate dev`.
- `DATABASE_URL` paths MUST be interpreted relative to `prisma/schema.prisma`.
- Development and test databases MUST remain isolated. E2E setup MUST only
  rebuild the database identified by `.env.test`.
- Agents MUST NOT run `prisma migrate reset`, `prisma db push --force-reset`,
  or another destructive database command. The user must run it directly after
  being warned of the exact target and impact.
- Cross-module transactions MUST follow the Unit of Work rule in
  [architecture.md](./architecture.md).

## Recommended practices

- Queries SHOULD select or include only the data required by the owning module.
- Concurrency-sensitive updates SHOULD include predicates that prove ownership
  of the current state and SHOULD check the affected-row count.

## Explicit permanent exceptions

- Controlled E2E setup MAY use non-production schema synchronization against
  the isolated `.env.test` database.

## Review checklist

- Does every touched model have the correct owner?
- Is the migration included and safe for existing data?
- Are database environments isolated?
- Are transaction and concurrency assumptions tested?
- Were destructive commands avoided?

## Related rules

See [architecture.md](./architecture.md) for ownership and Unit of Work and
[testing.md](./testing.md) for database isolation.
