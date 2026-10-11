# Git-workflow rules

## Purpose and scope

These rules apply to branches, commits, pushes, pull requests, hooks, and
repository handoff.

## Mandatory rules

- Work MUST branch from an up-to-date `main` unless the user explicitly chooses
  another base.
- Agents MUST NOT commit, push, or create a pull request unless the user asks.
- Agents MUST preserve unrelated user changes and MUST NOT use destructive Git
  commands without explicit authorization.
- Pre-commit MUST run `lint-staged`, full non-mutating lint, build, and unit
  coverage, aborting on the first failure.
- `--no-verify` MUST NOT be used without explicit prior user approval. The
  reason MUST be reported with the resulting commit and recorded as an approved
  exception in the applicable rule if it persists.
- Pull requests MUST use the repository template, include a short description,
  report verification, and identify any user-approved permanent exception.

## Recommended practices

- Branch and commit names SHOULD describe one coherent change.
- Commits SHOULD remain reviewable while preserving working intermediate states.

## Explicit permanent exceptions

Only the user may approve an exception to these rules. An agent may propose an
exception but MUST NOT approve one itself.

## Review checklist

- Is the branch based on the intended `main` revision?
- Were commit, push, and PR actions explicitly requested?
- Did hooks and applicable e2e verification pass?
- Does the PR include the short description and required verification details?

## Related rules

See [testing.md](./testing.md) for verification requirements and all other rule
documents for change-specific review.
