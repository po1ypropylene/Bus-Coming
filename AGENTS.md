# Working on Bus Coming

Read `docs/DEVELOPMENT.md` before making changes. Consult `docs/REQUIREMENTS-AND-STATUS.md` for implemented behavior and limitations, and `docs/API-RESEARCH.md` for operator contracts. Update the relevant documentation when changing behavior or architecture.

## Formatting

Follow the existing four-space source convention observed in `src/types/transit.ts`, `src/hooks/useUserData.ts`, `src/storage/userData.ts` and the stylesheets. Use spaces, not tabs; single quotes in JS/TS; no optional semicolons; trailing commas; a 100-column Prettier target; LF and a final newline. JSX uses double-quoted attributes. Let Prettier handle wrapping and required defensive semicolons instead of hand-formatting.

`.prettierrc.json` is authoritative. ESLint's Prettier integration enforces the same formatting for JS/TS/TSX, including tests and configuration. `.editorconfig` aligns editor indentation. Run `npm run format` and `npm run lint`; do not disable formatting rules or introduce a competing formatter configuration. CSS/JSON/Markdown are checked by `npm run format:check`.

## Implementation

- Keep `App.tsx` small. Screens go in `pages/`, reusable UI in feature folders under `components/`, state/side effects in `hooks/`, network/import adapters in `services/`, and persistence in `storage/`.
- Preserve existing user work. Never reset localStorage or IndexedDB to make an upgrade pass. Keep schema changes backward compatible and cover migrations with tests.
- Add English and Traditional Chinese UI text together. Follow system appearance, safe areas, reduced motion, keyboard focus and at least 44px touch targets.
- Use theme tokens, not hard-coded green accents. Keep operator badges and semantic status colours distinct. See the palette extension procedure in the development guide.
- Keep full catalogue downloads off the main thread and existing snapshots usable during refresh. Citybus's searchable index and on-demand route details must work before its full download completes.
- Never invent live routes, stops, GPS positions or ETAs. Keep ETA direction, service and stop sequence filtering intact.
- Add meaningful regression coverage for behavior and persistence changes. Run build, lint, formatting, unit and relevant browser checks. Run the production offline smoke check when changing persistence, startup, service workers or offline behavior.
- Record actual verification and remaining limits; do not equate emulated WebKit with physical iPhone validation. Do not claim current live API checks based on older evidence.

## App versioning

- Automatically advance the app version once per completed change set that changes shipped app code, behavior, assets or dependencies. Do not bump for documentation/instruction-only edits, tests alone, formatting alone, or each intermediate edit/rebuild. An explicit user version instruction takes precedence.
- Follow Semantic Versioning (`MAJOR.MINOR.PATCH`): patch for backward-compatible fixes, minor for backward-compatible features, and major for breaking changes. Reset lower components when increasing minor or major. Choose the highest level required by the complete change set; do not infer breaking changes from internal refactoring alone.
- `package.json` → `version` is the single editable app-version source. Use `npm version patch --no-git-tag-version`, `npm version minor --no-git-tag-version` or `npm version major --no-git-tag-version` to update it and the generated `package-lock.json` metadata together, without creating a commit or tag. Do not hand-edit version literals in UI or service workers.
- Vite injects `__APP_VERSION__` into the UI and derives the Workbox cache identity from that same value. The Settings footer displays the full version. The existing waiting-service-worker flow determines when a downloaded build is ready to apply; keep activation user-controlled and preserve stored user data. Never couple app versions to backup or IndexedDB schema versions.
- Rebuild after advancing the version. Run the required checks, including `npm run test:offline` and `node scripts/update-smoke.mjs` when changing version/update wiring. A version bump does not authorize deployment.

## Git commits and pushes

- After completing the requested changes and relevant verification, automatically commit the task's changes and push them to GitHub, including instruction-only updates such as this one. Do not wait for a separate commit or push request unless the user explicitly asks otherwise.
- Keep commit messages generic and as short as possible while naming the change, for example `Add sort ETAs`, `Tab bar UI improvements` or `Update agent instructions`. Detailed commit bodies are unnecessary.
- Review the diff before committing, stage only changes belonging to the task, and preserve unrelated user work. Push the current task branch to its configured remote; set its upstream when needed. Never force-push or rewrite shared history without explicit authorization.
- If verification, committing or pushing fails, report the actual failure and remaining work. Committing and pushing do not authorize deployment.
