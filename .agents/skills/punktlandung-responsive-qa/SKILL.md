---
name: punktlandung-responsive-qa
description: Run and interpret Punktlandung's Playwright responsive QA, inspect generated screenshots and reports, and optionally fix confirmed responsive layout defects. Use when the user asks to check responsive behavior, viewport sizes, mobile/desktop fit, visual QA, clipping, overflow, or says "Responsive QA pruefen" or "Responsive QA pruefen und beheben" in the Punktlandung repository.
---

# Punktlandung Responsive QA

Use the repository's deterministic QA script as the source of technical evidence. Read [references/product-rules.md](references/product-rules.md) before judging or changing layouts.

## Choose the mode

- For **check only**, run tests, inspect artifacts, and report findings. Do not change UI files.
- For **check and fix**, run tests, inspect artifacts, make the smallest confirmed layout fixes, and rerun affected checks until they pass or a real blocker remains.
- If the user does not specify whether to fix, default to check only.

## Run the workflow

1. Inspect `git status --short` and preserve unrelated user changes.
2. Confirm the app and one referenced `/_next/static/` asset respond successfully at `RESPONSIVE_URL` or `http://localhost:3000`. If HTML works but assets fail, treat the server as stale; restart it with a dedicated Next output directory and, when necessary, an isolated port passed through `RESPONSIVE_URL`.
3. Select the smallest useful scope:
   - One view: `npm run check:responsive -- --page=<name>`
   - One viewport: `npm run check:responsive -- --viewport=<name>`
   - Fast matrix: `npm run check:responsive:quick`
   - Full matrix: `npm run check:responsive`
4. Read both `test-artifacts/responsive/report.json` and `report.md`.
5. Inspect screenshots for failed checks and warnings. Also inspect representative changed states even when technical checks pass.
6. Separate definite defects from heuristic warnings. Treat approved product rules as authoritative.
7. In fix mode, change only relevant layout code. Do not silently update visual expectations to hide a regression.
8. Rerun the narrow failed checks, then the quick matrix for affected views. Use the full matrix for broad shared-style changes.
9. Report tested views and viewports, fixes, remaining warnings, and artifact paths concisely.

## Interpret results

- Treat horizontal overflow, disallowed non-mobile vertical scrolling, missing core states, HTTP failures, and relevant browser errors as failures.
- Treat possible text clipping and small touch targets as review candidates until visually confirmed.
- Allow vertical scrolling on mobile viewports and document/legal pages according to the product rules.
- Do not call a layout visually correct merely because the script exits successfully.
- Never modify application layout in check-only mode.

## Maintain coverage

When routes or major UI states change, update `scripts/responsive-check.mjs` in the same task. Prefer explicit state seeding for game states over brittle click chains. Keep third-party content deterministic or blocked during QA.
