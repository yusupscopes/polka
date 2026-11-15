# Spec: Tests and a GitHub Actions CI workflow

Status: Approved · Branch: `ci/tests-and-github-actions`

## Objective

Polka has no tests and no CI. Lint and typecheck only run when someone remembers to run them, and `npm run lint` already fails on `main`. This change does three things:

1. Adds a unit test setup with a few tests for the logic that is easiest to break without noticing: form validation and usage pricing.
2. Makes `npm run lint` and `npm run typecheck` pass on a fresh clone.
3. Adds a GitHub Actions workflow that runs lint, typecheck and tests on every push to `main` and every pull request.

The user is the project owner. Success means a red check on GitHub before a broken change reaches `main`, which Railway deploys from.

## Assumptions

1. Tests are unit tests only. They need no database, network, Clerk, Daytona, OpenAI or Trigger.dev, so CI needs no secrets.
2. CI runs lint, typecheck and tests only. It does not run `next build`, deploy, or `trigger.dev deploy`.
3. The runner is `ubuntu-latest` with Node 24, the version the README requires.
4. `npm ci` works from the committed lockfile. Checked on a fresh clone: it passes.

## Tech Stack

- Vitest 4 (`vitest@^4.1`) as the test runner, in the Node environment. Vitest 5 is also out, but it needs `@types/node` 22 or later and the project pins `^20`. If Vitest 4 has the same peer conflict, the build will raise `@types/node` to `^24`, matching the Node 24 runtime, as long as typecheck stays green. Otherwise it falls back to `--legacy-peer-deps`.
- GitHub Actions: `actions/checkout@v4` and `actions/setup-node@v4` with the npm cache.

## Commands

```
Test:       npm test                # vitest run
Test watch: npx vitest
Lint:       npm run lint            # eslint
Typecheck:  npm run typecheck       # next typegen && tsc --noEmit
```

`typecheck` changes from `tsc --noEmit` to `next typegen && tsc --noEmit`. On a fresh clone, `tsc` fails with `Cannot find name 'PageProps'` because the route types under `.next/types` don't exist yet. `next typegen` generates them without a build, so the same command works locally and in CI.

## Project Structure

```
vitest.config.ts                  → Node environment, @/ alias, include **/*.test.ts
lib/billing.ts                    → gains aiCostNanos (moved from lib/usage.ts)
lib/billing.test.ts               → aiCostNanos and sandbox price tests
lib/db/schema.test.ts             → insertBotSchema and insertGroupChatSchema tests
eslint.config.mjs                 → scoped ignores and overrides (see Lint)
trigger/example.ts                → `any` becomes `unknown`
.github/workflows/ci.yml          → the CI workflow
package.json                      → `test` script, `typecheck` script, vitest devDependency
```

Tests live next to the file they test, as `<name>.test.ts`.

## Tests

| File | What it checks |
| --- | --- |
| `lib/db/schema.test.ts` | `insertBotSchema`: trims name and job; rejects an empty or blank name with "Give your bot a name."; rejects a name over 50 characters and a job over 80; rejects a blank job with "Say what your bot is for."; accepts empty instructions and rejects instructions over 2000 characters; drops server-owned fields such as `userId` and `sandboxId`. `insertGroupChatSchema`: trims the name; rejects a blank name with "Give your group a name."; rejects fewer than two `botIds` with "Pick at least two bots." |
| `lib/billing.test.ts` | `aiCostNanos`: uncached input, cached input and output are each priced at their own `MODEL_PRICE` rate; cached tokens aren't counted twice; missing token counts are treated as 0. `SANDBOX_PRICE_NANOS_PER_SECOND` matches $0.0666 per hour. |

### Moving `aiCostNanos`

`aiCostNanos` is pure pricing math, but it lives in `lib/usage.ts`, which imports `server-only`, the database client and Clerk as soon as it loads. It moves to `lib/billing.ts`, next to `MODEL_PRICE`, with a type-only import of `LanguageModelUsage` from `ai`. Its two callers, `lib/usage.ts` and `trigger/chat.ts`, import it from there instead. No behavior changes.

## Lint

Make `npm run lint` exit 0 without weakening checks on the app's own code:

- Ignore `.agents/**`. These are skill scripts, not app code.
- Turn the React Compiler rules (`react-hooks/*` errors: `set-state-in-effect`, `refs`, `immutability`, `purity`, `static-components`) into warnings for vendored, generated code only: `components/ui/**`, `components/ai-elements/**` and `hooks/use-mobile.ts`.
- `trigger/example.ts`: change `payload: any` to `payload: unknown`.

Warnings are allowed. Errors fail CI.

## CI workflow

`.github/workflows/ci.yml`:

- Runs on `push` to `main` and on `pull_request`. Concurrency is grouped by ref, and in-progress runs on PRs are cancelled.
- One job, `ubuntu-latest`, with `permissions: contents: read` and a timeout of about 15 minutes.
- Steps: checkout → setup-node (Node 24, npm cache) → `npm ci` → `npm run lint` → `npm run typecheck` → `npm test`.
- No secrets and no `env` block.

## Code Style

Follow the repo as it is: Prettier with no semicolons and double quotes, and comments that explain why. A test looks like this:

```ts
import { describe, expect, it } from "vitest"

import { insertBotSchema } from "@/lib/db/schema"

describe("insertBotSchema", () => {
  it("rejects a blank name", () => {
    const result = insertBotSchema.safeParse({ ...validBot, name: "   " })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Give your bot a name.")
  })
})
```

## Boundaries

- **Always:** keep the tests free of the network and the database; run lint, typecheck and tests before each commit; leave `lib/db/schema.ts` importable from the client.
- **Ask first:** any change to billing behavior (prices, allowances, how charges are calculated); adding dependencies other than `vitest` (and `@types/node` if needed); rewriting vendored components.
- **Never:** add secrets to the workflow; deploy from CI; change the database schema; delete or skip a failing check to get green.

## Success Criteria

1. `npm test` runs and passes, with at least the cases in the Tests table.
2. `npm run lint` exits 0 on this branch.
3. `npm run typecheck` exits 0 on a fresh clone, with no `.next` directory.
4. `.github/workflows/ci.yml` runs lint, typecheck and tests on pushes to `main` and on PRs, and passes on this branch's PR.
5. `aiCostNanos` gives the same results from `lib/billing.ts`, and nothing imports it from `lib/usage.ts`.
6. The README gains `npm test` in its Scripts table and a CI badge.

## Out of Scope

- Tests that need a database or external services (`chargeSandbox`, `getUsagePeriod`, server actions, the agent).
- Component and E2E tests.
- `next build` in CI, coverage thresholds, and branch protection rules (those are set in GitHub settings).

## Open Questions

None. Lint scope, test runner and the `aiCostNanos` move were decided before this spec.
