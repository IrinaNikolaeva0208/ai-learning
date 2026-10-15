# Git-workflow rules

## Purpose and scope

These rules apply to branches, commits, pushes, pull requests, hooks, and
repository handoff.

## Mandatory rules

- Before starting a new standalone task that will change repository files, an
  agent MUST ask whether the user wants a new branch and MUST wait for a yes or
  no answer before editing. The agent MUST NOT ask when the work is read-only,
  the user already specified a new branch or the current branch, or the work is
  clearly a continuation of the current task, CI fix, review finding, or pull
  request.
- If the user chooses a new branch, the agent MUST use the latest fetched
  `origin/<base>` when it exists. The base defaults to `main`; a base explicitly
  named by the user takes precedence and becomes the pull-request target. If
  the base has no remote branch, the agent MAY use a verified local branch. It
  MUST NOT alter the local base branch merely to create the new branch.
- New branch names MUST use `<label>/<short-kebab-case-name>`. Allowed labels
  are `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`, `build`, `perf`,
  and `revert`. Existing branches created before this rule are grandfathered.
  If a requested name is nonconforming, the agent MUST propose a compliant
  name and wait unless the user explicitly approves an exception.
- If a proposed branch name already exists, the agent MUST reuse it only when
  it clearly belongs to the same task. Otherwise it MUST choose another concise,
  descriptive name rather than append an arbitrary number.
- The agent MUST preserve unrelated user changes. If such changes are present
  before branch creation, it MUST NOT stash, move, commit, or carry them to a
  different base automatically; it MUST stop and ask how to proceed.
- If the user declines a new branch, work continues on the current branch. If
  that branch is also the intended pull-request target, the agent MUST warn
  that delivery requires a direct push and no pull request can be created, then
  obtain separate explicit confirmation before editing.
- A pull request MUST target, in order of precedence, the branch explicitly
  named by the user, the existing pull request's base for continuation work,
  the base from which the new branch was created, or `main`. The agent MUST
  preserve this target throughout the task.
- After completing a file-changing task, the agent MUST commit, push, and create
  or update a pull request without requesting additional approval unless the
  user opted out of a delivery step. Read-only work, no-diff results, incomplete
  work, and blocked work do not trigger automatic delivery.
- Before committing, the agent MUST run every e2e test required by
  [testing.md](./testing.md). A normal commit MUST then run `lint-staged`, full
  non-mutating lint, build, and unit coverage through the pre-commit hook,
  aborting on the first failure.
- When required verification fails because of the current task, the agent MUST
  diagnose and fix it, then rerun the affected verification. If the fix would
  materially expand scope or require a user decision, the agent MUST stop and
  ask. If evidence cannot confidently attribute a failure to the task, the
  agent MUST treat it as unrelated, block publication, report the reason, and
  ask how to proceed.
- Commits MUST use Conventional Commit subjects and contain coherent changes.
  A task MAY use multiple commits when its changes are genuinely separate.
  Automatic delivery MUST create new commits; it MUST NOT amend or squash
  existing commits without explicit user direction.
- Before publication, all required checks and the commit MUST have succeeded,
  and the worktree MUST contain no unrelated changes. The agent MUST NOT publish
  known failures or changes it cannot separate safely.
- The agent MUST push to the current branch's configured upstream when one
  exists, otherwise to `origin`. It MUST stop if the destination is missing or
  ambiguous. If the remote branch has unexpected commits or publication would
  require a force push, the agent MUST ask rather than merge, rebase, rewrite,
  or force-push automatically.
- A new pull request MUST always be created as a draft. Only the user may mark
  it ready or merge it. Before pushing new commits to an existing ready pull
  request, the agent MUST return it to draft and MUST block the push if it
  cannot do so. Existing pull requests MUST be updated instead of duplicated,
  and their base MUST remain unchanged.
- Pull requests MUST use the repository template and include a concise
  description, the target branch, actual verification results, schema and
  security impact, and every user-approved exception. Unknown or failed checks
  MUST NOT be reported as passing.
- For push, draft-state, or pull-request creation failures, the agent MAY retry
  only clearly transient failures. It MUST NOT select another remote or rewrite
  history as recovery, and it MUST report the exact partial publication state.
- Automatic delivery does not authorize merging. Agents MUST NOT merge a pull
  request without a separate explicit user request.
- Agents MUST NOT use destructive Git commands without explicit authorization.
- `--no-verify` MUST NOT be used without explicit prior user approval. The
  reason MUST be reported with the resulting commit and recorded as an approved
  exception in the applicable rule if it persists.

## Recommended practices

- Branch names SHOULD be as short as clarity permits.
- Commits SHOULD remain reviewable while preserving coherent intermediate
  states.

## Explicit permanent exceptions

Only the user may approve an exception to these rules. An agent may propose an
exception but MUST NOT approve one itself.

## Review checklist

- Was the branch decision resolved before edits, or did a defined no-prompt
  case apply?
- Does a new branch have a compliant name and the intended, current base?
- Is the recorded pull-request target correct?
- Did applicable e2e tests and the normal pre-commit hook pass?
- Are unrelated changes absent and remote history safe to publish?
- Is the pull request a draft with the required description and verification?
- Were partial failures and user-approved exceptions reported accurately?

## Related rules

See [testing.md](./testing.md) for verification requirements and all other rule
documents for change-specific review.
