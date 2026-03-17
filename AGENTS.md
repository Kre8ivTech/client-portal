# AGENTS.md
Agent guidance for coding assistants working in `client-portal`.

## Scope and precedence
1. Follow runtime system/developer instructions first.
2. Then follow `CLAUDE.md`.
3. Then follow this file.
4. If present, also follow `.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`.

Current scan in this repo:
- `.cursor/rules/`: not found
- `.cursorrules`: not found
- `.github/copilot-instructions.md`: not found

If any are added later, read and apply them before making changes.

## Environment
- Node: `20.x` (see `package.json` engines)
- Package manager: `npm`
- Framework: Next.js App Router + TypeScript
- Database: Supabase PostgreSQL + RLS

## RTK command proxy
`CLAUDE.md` references `/Users/jlaptop/.claude/RTK.md`.
- Prefer `rtk` when available for command telemetry/token savings.
- Use these RTK meta commands directly when needed:

```bash
rtk gain
rtk gain --history
rtk discover
rtk proxy <cmd>
```

## Install and run
```bash
npm install
npm run dev
```

## Build, lint, test
Run from repo root.

Core checks:
```bash
npm run lint
npm run type-check
npm test
```

Build commands:
```bash
npm run build
npm run build:local
```
`build` runs migrations first via `npm run migrate`.

Coverage/E2E:
```bash
npm run test:coverage
npm run test:e2e
```

## Single-test execution (preferred)
Use the smallest test scope that verifies your change.

Vitest single file:
```bash
npx vitest run tests/unit/path/to/file.test.ts
```

Vitest single test name:
```bash
npx vitest run tests/unit/path/to/file.test.ts -t "renders empty state"
```

Vitest watch single file:
```bash
npx vitest tests/unit/path/to/file.test.ts
```

Playwright single spec:
```bash
npx playwright test tests/e2e/path/to/spec.spec.ts
```

Playwright single test title:
```bash
npx playwright test -g "user can create ticket"
```

## Repo workflow defaults
1. Read relevant files before editing.
2. Make minimal, focused changes.
3. Run targeted tests first, then broader checks.
4. Finish with `npm run lint` and `npm run type-check`.
5. Run full suite only for broad/risky changes.

## Code style and architecture
### TypeScript and React
- Keep strict TypeScript; avoid `any` unless unavoidable.
- Prefer explicit types on public boundaries.
- Use functional components and hooks.
- Default to Server Components; add `'use client'` only when needed.
- Avoid server-data fetching in `useEffect` when server loading or React Query is better.

### Imports/modules
- Use `@/*` alias for `src/*` imports.
- Group imports: external first, internal second.
- Remove unused imports.

### Naming/files
- Components: PascalCase.
- Hooks/utils: camelCase.
- One component per file.
- Keep files cohesive; avoid multi-purpose modules.

### Formatting/lint
- ESLint (`next/core-web-vitals`) is source of truth.
- Do not add new formatting tooling unless requested.
- Avoid unrelated formatting churn.

### State/data fetching
- React Query for server state.
- `useState` for local UI state.
- Zustand only for truly shared client-only state.
- Keep shareable filter/sort/tab state in URL params.

### Supabase and multi-tenancy
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code.
- Browser code must use browser Supabase client.
- Server code must use server Supabase client.
- Respect RLS and tenant boundaries.
- Select only needed columns.

### Validation/errors/security
- Validate external input with Zod.
- Handle errors explicitly; avoid swallowed exceptions.
- Sanitize user-provided rich text before rendering.
- Verify inbound webhook signatures.
- Keep auth redirects strict; avoid open redirects.

### Testing expectations
- Add/update tests for behavior changes.
- Prefer focused unit tests for logic changes.
- Add/adjust E2E tests for critical flows.
- Add regression tests for bug fixes when practical.

## Agent PR checklist
- [ ] Scoped to requested task
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] Relevant tests pass
- [ ] No secrets added
- [ ] No unrelated files modified
