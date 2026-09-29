# Development guide

Last updated: 21 September 2026.

## Starting points

Read [README](../README.md) for setup, commands, HTTPS and iPhone testing; [requirements and status](REQUIREMENTS-AND-STATUS.md) for behavior and limitations; [API research](API-RESEARCH.md) for operator endpoints and normalization. [AGENTS.md](../AGENTS.md) is the repository instruction file for future coding agents.

## Code style and editor setup

The source convention is **four spaces**, not tab characters, with single quotes, no optional semicolons, trailing commas and a 100-column wrapping target. JSX attributes use double quotes. Prettier decides wrapping, JSX spacing and required defensive semicolons. Existing uneven JSX indentation has been normalized to the same convention.

- `.prettierrc.json` is the canonical formatter configuration.
- `eslint.config.js` includes `eslint-plugin-prettier/recommended` last: formatting differences fail lint and conflicting ESLint style rules are disabled by `eslint-config-prettier`.
- `.editorconfig` supplies four-space indentation, UTF-8, LF and final newlines to WebStorm and other editors. Markdown retains intentional trailing spaces.
- In WebStorm, enable EditorConfig support; under **Languages & Frameworks → JavaScript → Prettier**, select this project's installed Prettier and enable **Run on save** and **Run on Reformat Code**. Use automatic ESLint configuration. If editor defaults differ, the checked-in configuration wins.
- `npm run format` normalizes tracked project text; `npm run format:check` checks it without editing. `npm run lint` checks code quality and JS/TS formatting. Generated assets, build output, test screenshots and dependency files are excluded where appropriate.

## Module ownership

| Folder                     | Responsibility                                    |
| -------------------------- | ------------------------------------------------- |
| `src/app`                  | Context, provider and screen composition          |
| `src/pages`                | Screen-level markup                               |
| `src/components/<feature>` | Reusable UI such as route keypad and theme picker |
| `src/hooks`                | React state, user actions and side effects        |
| `src/services/catalog`     | Operator imports and on-demand route loading      |
| `src/services/api.ts`      | HTTP retries and live arrival adapters            |
| `src/storage`              | Persistent user data and IndexedDB schema         |
| `src/types`, `src/utils`   | Domain contracts and pure transformations         |
| `src/i18n`                 | English and Traditional Chinese UI copy           |
| `src/styles`               | Global, application and theme styles              |
| `src/workers`              | Off-main-thread catalogue import orchestration    |

Keep `App.tsx` as an entry point. Feature logic belongs in the modules above rather than growing the entry component again.

## Persistence and upgrades

`bus-coming-user-v1` in localStorage stores version 1 user data: language, theme and bookmarks. `validateUserData` is the boundary for both stored data and imported backups. Old records without `theme` normalize to `green`; all five known strings are accepted, while supplied unknown/null values are rejected. Adding this optional-on-input field does not require clearing data or changing the version/key. New writes and exports include the normalized theme. If storage writes fail, the current session still updates and the app reports the save failure.

Backups merge bookmarks by ID, with imported entries winning conflicts, and restore imported preferences. An older backup defaults the theme to green. Invalid imports do not overwrite existing data. Imports remain limited to 10 MB and 1,000 bookmarks. Keep migration coverage when adding fields.

IndexedDB `bus-coming-v1`, schema version 2, contains `snapshots`, `responses`, `generations`, `routeCatalogs` and `routeDetails`. Complete provider snapshots commit atomically; interrupted downloads resume checkpoints. Do not rename/delete stores or clear data to work around a migration. User bookmarks remain separate from replaceable route data.

## Theme implementation and extension

Settings offers Green (default), Blue, Yellow, Red and Purple through a native radio group with visible labels, selected checkmarks and keyboard focus. Preferences are translated and persist across reloads and backup export/import. Appearance continues to follow the device's light/dark setting.

- `THEMES` and `Theme` in `src/types/transit.ts` define allowed identifiers.
- `src/components/settings/ThemePicker.tsx` renders the choices.
- `src/hooks/useTheme.ts` applies `data-theme` to the root before paint and updates the browser theme-colour metadata when either the palette or system appearance changes.
- `src/styles/themes.css` defines paired light/dark accent, background, foreground and soft surface tokens. Application decoration uses those tokens; operator badges and success/error indicators retain their semantic colours.
- `src/i18n/index.ts` supplies colour labels for both languages.

To add a palette, add its identifier, both translated labels, both complete CSS token sets (including surface, border `--line`, secondary text `--muted` and shadow), and extend migration/browser tests. Check accent-to-surface contrast of at least 4.5:1, keyboard interaction, visible selection, mobile wrapping and dark appearance. Yellow deliberately uses a darker gold accent in light appearance for readable text. The install icon and manifest retain the app's fixed green brand; the running app's browser chrome follows the selected palette where the browser supports it.

## Verification and release workflow

Run `npm run format:check`, `npm run lint`, `npm test`, `npm run build` and `npm run test:e2e`. Browser tests cover Chromium desktop and 440×956 WebKit mobile. Theme regressions cover all five colours in both appearances, contrast, metadata, reload persistence, export/import and Chinese labels; unit tests cover old-data defaults and invalid preferences.

Run `npm run test:offline` for startup, persistence or PWA changes. Vite development does not register a service worker; test offline behavior against a production build. A production preview uses the last built files, so rebuild it after source changes. Existing installed clients may need to close/reopen to activate a new service worker.

Live API audits/imports are separate, potentially lengthy network checks. Do not run them just to verify colour or formatting changes. The API research and previous live results are dated evidence, not a promise of current counts.

Update requirements/status with what was actually tested. Hardware-only checks still include iPhone installation, safe areas, real GPS permission, VoiceOver and large text. Do not publish/deploy solely because local checks pass unless deployment is part of the request.

## Operator-specific ETA matching

Do not apply KMB's sequence semantics indiscriminately to Citybus. The N8P live audit in `API-RESEARCH.md` demonstrates inbound ETA sequences offset from the route-stop catalogue. `selectCitybusArrivals` matches a unique stop by identity and direction, retaining exact sequence checks for repeated or unknown visits. Keep these regression tests when changing adapters. Never fall back to the opposite direction just because no matching ETA is available. Run `node scripts/audit-citybus-route.mjs ROUTE` to capture a targeted public-data reproduction before changing assumptions.

## Installed-app update lifecycle

`useAppUpdate` owns production-only native service-worker registration, using `updateViaCache: 'none'`. Vite PWA uses `registerType: 'prompt'` and `injectRegister: false`; do not reintroduce a second generated registration script. Workbox retains precaching and `clientsClaim`, with `SKIP_WAITING` activated only by the user's update button. The app checks at startup, foreground/pageshow/reconnection (one-minute throttle), hourly while active, and on demand in Settings. A downloaded update shows a bilingual reload notice; first installation does not force a reload. Failed/offline checks retain the working cache and display a retryable Settings status.

Update activation never deletes localStorage or IndexedDB. The reload replaces in-memory UI state, so users choose when to apply it. An older deployed client cannot run this new updater until its existing service-worker lifecycle delivers the first new build; see README for close/reopen bootstrap and hosting cache headers. The same-origin service-worker URL and scope must remain stable.

`node scripts/update-smoke.mjs` serves three revisions of the production shell without modifying `dist`, verifying waiting-worker detection, explicit activation/reload, preference persistence and the current-version check and simulated resume detection. Run this and the offline smoke check for registration changes; Vite dev does not install the worker. Automatic checks cannot execute while iOS suspends or closes the app.

## Mobile route search layout

At widths up to 700px, `.route-search-shell` uses the dynamic viewport height and safe-area padding. Search controls, an
independently scrollable result list, and the custom keypad occupy separate grid rows; the tab bar stays in normal flex
flow below them. Numbers remain in a 3-column pad, with a separate 2-column scrolling letter list. Hiding the keypad
expands the results. Query/operator changes reset only the results scroll position, so matches stay visible while
typing. Route details leave this constrained shell and use normal page scrolling. Desktop retains its sidebar layout.
Keep keyboard focus, 44px keys and the 320×568 / 440×956 geometry regression when changing this screen.

## Joint routes

Read [JOINT-ROUTES.md](JOINT-ROUTES.md) before changing joint membership, journey/stop matching or ETA aggregation.
`services/joint/` owns the official TD adapter, conservative pairing and combined arrivals. `useJointItinerary` includes
partner-only stops without changing provider IDs or API sequences. Keep raw provider snapshots independent, never
persist derived `jointPartners`, and resolve old bookmarks through their original route ID. There is no manual
membership registry. Keep failures partial and explicit; do not merge by route number or O/I code alone.

## Bookmark ordering

The existing `user.bookmarks` array is the display order; no schema or storage-key change is needed.
`utils/bookmarks.ts` contains immutable move/save helpers. Reordering swaps adjacent visible bookmarks; in a filtered
group it swaps their original array slots so hidden bookmarks never move. `BookmarkOrder` provides a compact ordered
list with translated 44px up/down controls, disabled boundaries and screen-reader position announcements. Each move
uses the normal user-data persistence/error path. Editing a group preserves the bookmark's array position; new stops
append. Export preserves array order. Import into an empty collection restores it; merging into an existing collection
keeps existing positions and appends new IDs in imported order, as before. Do not change this silently.

## ETA display ordering

All arrival panels use `utils/arrivals.ts` through `useArrivals`: discard expired predictions, sort by absolute arrival
timestamp, then take the first three. Untimed remarks follow timed predictions; equal-time buses and their remarks
remain distinct. Never assume operator response order is chronological (rush-hour service variants may be grouped).
Keep provider direction/service/stop filtering in the adapters; display sorting must not broaden those matches.

## Route direction switching

`utils/routeDirection.ts` chooses the opposite journey from the full `byRoute` index, which includes hidden Citybus
identities for joint services and the early Citybus catalogue. Prefer the same operator, number and service with the
opposite bound. NLB uses separate route IDs with bound O, so require uniquely reversed terminals instead. Never match
another operator by number alone. Only an established joint partner can supply a fallback when the current operator
has no reverse record. Keep the target's derived partners, not the source's: 106 has opposite O/I conventions between
KMB and Citybus. Ambiguous or absent candidates hide the switch; do not fall back to a different KMB service type.

The bilingual direction button previews the target destination. `openRoute` clears expanded stop state and scrolls to
the top; route details are keyed by route ID to reset local detail/itinerary state. Citybus details load on demand as
usual. Its early index contains provisional directions; an empty upstream direction displays the existing no-stops
message. Complete catalogues omit empty directions. This feature does not reverse stop arrays or rewrite bookmarks.
