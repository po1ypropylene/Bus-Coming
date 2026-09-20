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
