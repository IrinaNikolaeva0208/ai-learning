# Code-style rules

## Purpose and scope

These rules apply to hand-written TypeScript. Specs and recognized test-support
files also follow this document except for the explicit test exceptions below.

## Mandatory rules

- Production source MUST use ESM `import` and `export` syntax and named exports.
  Default exports MUST NOT be used.
- Every hand-written non-test TypeScript file under `src/`, and every production
  script, MUST have at most one exported application symbol. A file MAY export
  nothing.
- Every exported interface, type, and enum MUST be declared in its own file.
  The filename MUST be kebab-case and end in `.interface.ts`, `.type.ts`, or
  `.enum.ts` respectively.
- Generic declaration filenames such as `types.ts`, `interfaces.ts`, and
  `models.ts` MUST NOT be used.
- Injectable application behavior MUST use `*.service.ts` and a `*Service`
  class. Data access MUST use `*.repository.ts` and a `*Repository` class.
  Mapping MUST use `*.mapper.service.ts` and a `*MapperService` class.
- Framework primitives MUST retain conventional suffixes such as `.guard.ts`,
  `.pipe.ts`, `.interceptor.ts`, `.filter.ts`, and `.middleware.ts`.
  Controllers, modules, DTOs, factories, and errors MUST likewise use their
  role-specific suffixes.
- Files MUST use kebab-case; exported symbols MUST use PascalCase. Interfaces
  MUST NOT use an `I` prefix.
- Non-exported constants and private helpers MAY remain beside their sole
  consumer. A reusable application declaration MUST be moved to its own file.
- Code MUST pass the repository's type-checked ESLint and Prettier configuration.
  Type errors MUST be fixed rather than hidden with `any` or unsafe casts.

## Recommended practices

- Nest components SHOULD be generated with the Nest CLI when practical.
- Names SHOULD describe domain purpose before architectural role, for example
  `page-metadata-extractor.service.ts`.

## Explicit permanent exceptions

- Specs MAY contain multiple test-local declarations and helpers. They MUST NOT
  export production symbols.
- Files in `src/test-support/` or `test/support/`, and files named
  `*.fixture.ts`, `*.factory.ts`, `*.stub.ts`, or `*.mock.ts`, MAY contain
  multiple exports and need not follow production file organization. They MUST
  only be imported by tests or other test-support files.
- Tool configuration and test setup MAY use CommonJS only when the tool
  demonstrably requires it. All other applicable style rules still apply.
- Generated and vendored code is exempt and MUST NOT be manually restyled.

## Review checklist

- Does each production file have at most one named export?
- Are exported interfaces, types, and enums isolated and specifically named?
- Do injectable filenames and class names identify their architectural role?
- Are test exceptions confined to recognized test-only files?
- Do lint and formatting pass without introducing `any`?

## Related rules

See [testing.md](./testing.md) for test-support constraints and
[mapping.md](./mapping.md) for mapper naming and responsibilities.
