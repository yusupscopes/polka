# Todo: Tests and a GitHub Actions CI workflow

Plan: `tasks/tests-and-github-actions-plan.md`

## T1: Add Vitest and schema tests (M)

- [x] T1
  - Acceptance: `vitest@^4` is a devDependency; `npm test` runs `vitest run`; `vitest.config.ts` uses the Node environment and the `@/` alias; `lib/db/schema.test.ts` covers every `insertBotSchema` and `insertGroupChatSchema` case in the spec's Tests table, and they pass.
  - Verify: `npm test`, `npm run typecheck`
  - Files: `package.json`, `package-lock.json`, `vitest.config.ts`, `lib/db/schema.test.ts`
  - Depends on: none

## T2: Move `aiCostNanos` to `lib/billing.ts` and test pricing (M)

- [x] T2
  - Acceptance: `aiCostNanos` is exported from `lib/billing.ts` and no longer from `lib/usage.ts`; `lib/usage.ts` and `trigger/chat.ts` import it from billing; `lib/billing.test.ts` covers uncached, cached and output pricing, missing counts, and the sandbox price per second.
  - Verify: test written first (RED: import fails), then `npm test` and `npm run typecheck` green; `grep -rn aiCostNanos` shows no import from `@/lib/usage`
  - Files: `lib/billing.ts`, `lib/billing.test.ts`, `lib/usage.ts`, `trigger/chat.ts`
  - Depends on: T1

## Checkpoint A

- [x] `npm test` and `npm run typecheck` green

## T3: Make `npm run lint` exit 0 (S)

- [x] T3
  - Acceptance: `.agents/**` ignored; `react-hooks/*` rules are warnings in `components/ui/**`, `components/ai-elements/**` and `hooks/use-mobile.ts` only; `trigger/example.ts` uses `unknown`; `npm run lint` exits 0, and an `any` or a React Compiler violation added under `app/` still errors.
  - Verify: `npm run lint; echo $?` → 0. Spot check: a temporary `any` in an app file errors (then reverted)
  - Files: `eslint.config.mjs`, `trigger/example.ts`
  - Depends on: none

## T4: Make `npm run typecheck` work on a fresh clone (XS)

- [x] T4
  - Acceptance: `typecheck` is `next typegen && tsc --noEmit`; passes in a fresh clone with no `.next/`.
  - Verify: fresh clone in the scratchpad → `npm ci` → `npm run typecheck`
  - Files: `package.json`
  - Depends on: none

## Checkpoint B

- [ ] In a fresh clone: `npm ci`, `npm run lint`, `npm run typecheck` and `npm test` all exit 0

## T5: Add the CI workflow (S)

- [ ] T5
  - Acceptance: `.github/workflows/ci.yml` runs on push to `main` and on `pull_request`; uses concurrency that cancels in-progress PR runs; `permissions: contents: read`; one job on `ubuntu-latest`, Node 24 with npm cache, timeout of 15 minutes; steps `npm ci` → lint → typecheck → test; no secrets.
  - Verify: the YAML parses; every step's command passed at Checkpoint B
  - Files: `.github/workflows/ci.yml`
  - Depends on: T1 to T4

## T6: README: `npm test` and a CI badge (XS)

- [ ] T6
  - Acceptance: the Scripts table lists `npm test`, `npm run typecheck` mentions typegen, and a CI badge points to the workflow.
  - Verify: read the rendered diff
  - Files: `README.md`
  - Depends on: T5

## Checkpoint C

- [ ] All spec success criteria met locally; the workflow run itself is checked once a PR exists
