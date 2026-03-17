# Browser Tester

pnpm monorepo. Vite+ (`vp`) for builds, lint, format, and test.

## Verify changes

```bash
pnpm lint && pnpm format:check
```

## Code style

- `interface` over `type`. `Boolean` over `!!`. Arrow functions only.
- No comments unless it's a hack (`// HACK: reason`).
- No type casts (`as`) unless unavoidable.
- No unused code, no duplication.
- Descriptive variable names (no shorthands or 1-2 char names).
- kebab-case filenames.
- Magic numbers go in `constants.ts` as `SCREAMING_SNAKE_CASE` with unit suffixes (`_MS`, `_PX`).
- One focused utility per file in `utils/`.
