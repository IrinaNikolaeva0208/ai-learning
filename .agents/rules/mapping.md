# Mapping rules

## Purpose and scope

These rules govern transformations between persistence, application, transport,
inter-module, and external representations.

## Mandatory rules

- Representation-boundary mapping MUST be performed by an injectable,
  stateless `*MapperService` in a `*.mapper.service.ts` file.
- Mappers MUST be used for persistence records to domain/application models,
  domain/application models to response DTOs, input DTOs to commands when the
  shapes differ, inter-module contracts, and external library or HTTP models to
  application models.
- A mapper MAY contain multiple closely related methods for one aggregate or
  external boundary. Unrelated dependencies or boundaries MUST use separate
  mappers.
- Mappers MUST NOT perform validation, fetching, parsing, business decisions,
  persistence, logging, configuration access, or time-dependent work.
- Prisma queries, framework configuration, log objects, and values crossing a
  boundary with exactly the required shape MAY be constructed without a mapper.
- Parsing, validation, fetching, extraction, and calculation MUST remain in
  their appropriately named services. Mechanical representation conversion
  discovered during that work still belongs in a mapper.

## Recommended practices

- Mapping methods SHOULD make their source and destination clear from their
  names and types.
- Mappers SHOULD fail explicitly when required persistence invariants are
  missing rather than returning partial models.

## Explicit permanent exceptions

There are no permanent exceptions.

## Review checklist

- Does every representation boundary use the appropriate mapper?
- Is the mapper limited to deterministic transformation?
- Are parsing, validation, I/O, and business decisions outside the mapper?
- Is each mapper scoped to one aggregate or external boundary?

## Related rules

See [architecture.md](./architecture.md) for dependency direction and
[code-style.md](./code-style.md) for mapper naming.
