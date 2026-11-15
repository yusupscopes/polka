# Implementation Plan: Tests and a GitHub Actions CI workflow

Spec: `docs/specs/tests-and-github-actions.md` · Todo: `tasks/tests-and-github-actions-todo.md`

## Overview

Add Vitest with two unit test files (form schemas, usage pricing), make lint and typecheck pass on a fresh clone, then add a CI workflow on GitHub Actions that runs all three. The workflow goes last, after every command it calls already passes locally.

## Architecture Decisions

- **Vitest 4 in the Node environment.** It needs no DOM, and the `@/` alias is set in `vitest.config.ts` to mirror `tsconfig.json`. If `npm i -D vitest@^4` hits a peer conflict on `@types/node`, raise `@types/node` to `^24` (the Node 24 runtime) and keep it only if typecheck stays green. Otherwise fall back to `--legacy-peer-deps`.
- **Tests sit next to their source** (`lib/billing.test.ts`), so `tsc` and ESLint check them like any other file.
- **Move `aiCostNanos` to `lib/billing.ts`, not mock it.** The pricing math then has no server-only imports, and the test needs no `vi.mock`.
- **Scope lint, don't rewrite vendored code.** Ignore `.agents/**`, and turn React Compiler rules into warnings only in `components/ui/**`, `components/ai-elements/**` and `hooks/use-mobile.ts`.
- **`typecheck` runs `next typegen` first**, so local runs and CI use one command and neither depends on a leftover `.next/`.
- **The workflow uses no secrets.** Nothing it runs touches external services.

## Dependency Graph

```
T1 Vitest + schema tests ──┬── T2 move aiCostNanos + billing tests
                           │
T3 lint green ─────────────┼── T5 CI workflow ── T6 README
T4 typecheck on fresh clone┘
```

T1 comes first because adding a dependency is the riskiest step (peer conflict). T3 and T4 don't depend on T1, but T5 needs T1 to T4.

## Task List

### Phase 1: Tests
- [ ] T1: Add Vitest and schema tests
- [ ] T2: Move `aiCostNanos` to `lib/billing.ts` and test pricing

### Checkpoint A
- [ ] `npm test` green; `npm run typecheck` green

### Phase 2: Green gates
- [ ] T3: Make `npm run lint` exit 0
- [ ] T4: Make `npm run typecheck` work on a fresh clone

### Checkpoint B
- [ ] lint, typecheck, test all green in a fresh clone (`npm ci` + the three commands)

### Phase 3: CI and docs
- [ ] T5: Add `.github/workflows/ci.yml`
- [ ] T6: README: `npm test` and a CI badge

### Checkpoint C
- [ ] All spec success criteria met locally; criterion 4 (the workflow passes on GitHub) is checked when the PR is opened

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Vitest's `@types/node` peer conflicts with `^20` | Med | Use Vitest 4. If it still conflicts, bump `@types/node` to `^24` and confirm typecheck. Fall back to `--legacy-peer-deps` |
| npm 11 blocks install scripts (seen on `npm ci`: esbuild, unrs-resolver) and breaks Vitest or ESLint in CI | Med | Run the full gate set in a fresh `npm ci` clone at Checkpoint B, the same way CI installs |
| `next typegen` needs env vars or network in CI | Low | Already checked: it ran in a fresh clone with no `.env.local` |
| Moving `aiCostNanos` changes billing | High if wrong | Pure move. The tests pin its outputs, and typecheck covers both callers |
| The workflow can't be run locally | Med | Each step's command is checked in a fresh clone. The real run is checked when the PR opens (Phase 7), and the summary says so |

## Open Questions

None.
