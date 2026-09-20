# Bus Coming · 巴士就到

A mobile-first React + TypeScript bus ETA app for Hong Kong. KMB / Long Win, Citybus and New Lantao Bus; English and Traditional Chinese. iOS-inspired interface with Home Screen installation, offline route search, grouped bookmarks and GPS nearby stops.

## Run locally

Requires Node 22.12+ (or a current supported Node release) and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Initial launch downloads real operator data into IndexedDB. Citybus route search becomes available as soon as its small route index loads; opening a route loads its stops on demand. The full Citybus offline catalogue still requires thousands of individual requests, and downloads independently of KMB/NLB. Download progress is in Settings. Existing downloaded data stays usable during updates.

```sh
npm run build
npm run preview
```

The production build in `dist/` includes the service worker; development deliberately does not register one. Host `dist/` at the root of an HTTPS origin. No backend, API key, account, paid service or environment secrets are needed. No hosting deployment has been performed.

## WebStorm and iPhone 17 Pro Max

Open this folder in WebStorm and select the shared **Bus Coming — development** npm run configuration under `.run/`. Alternatively run the `dev` script from the package.json gutter or npm tool window.

### Browser emulation

1. Open the local URL in Chrome, open DevTools, toggle the device toolbar.
2. Add a custom mobile device named **iPhone 17 Pro Max**: **440 × 956 CSS pixels**, **device pixel ratio 3**, mobile/touch enabled. [Apple specifies](https://support.apple.com/en-my/125091) 1320 × 2868 physical pixels; dividing these by 3 gives this CSS test size. Browser chrome and safe areas affect the actual available viewport.
3. Check light/dark appearance, portrait/landscape, text zoom and a narrower 320px screen.
4. For a Safari-engine check, use the included Playwright WebKit profile:

```sh
npx playwright install chromium webkit
npm run test:e2e
npx playwright test --project=iPhone-17-Pro-Max-WebKit --headed
```

This is WebKit emulation at the requested screen size, not proof of actual iPhone hardware behavior. The inherited mobile user agent is a Playwright iPhone profile; geometry is explicitly overridden to 440 × 956.

### On your physical iPhone

The development server listens on all interfaces. A phone on the same Wi-Fi can open the displayed LAN URL for basic layout testing. **A plain HTTP LAN URL cannot exercise geolocation or Home Screen offline caching reliably.** Use a trusted HTTPS development certificate or an HTTPS staging host for those features.

For local HTTPS, create and trust a development CA using your usual tooling (for example mkcert), install/trust its CA on your iPhone, and start Vite with `BUS_HTTPS_KEY` and `BUS_HTTPS_CERT` pointing to PEM files. The certificate must include your Mac's LAN IP or hostname. This repo supports these optional variables in `vite.config.ts`; never commit private keys. macOS trusting the certificate does not automatically make the iPhone trust it. Keep the phone and Mac on the same reachable network.

In Safari: Share → Add to Home Screen → leave **Open as Web App** enabled. Launch from the new icon while online once, then verify offline search. Safari and the installed web app can have separate local storage: export bookmarks in Settings before installation and import the JSON inside the installed app if needed. On macOS Safari, enable the Develop menu and use the connected iPhone's Web Inspector to debug the installed app.

## Commands

| Command                       | Purpose                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run dev`                 | Development server, LAN-accessible                                                                   |
| `npm run build`               | Type checking and production PWA build                                                               |
| `npm run preview`             | Serve production build locally                                                                       |
| `npm run lint`                | ESLint                                                                                               |
| `npm test`                    | Data normalization, ETA filtering and backup validation                                              |
| `npm run test:e2e`            | WebKit mobile + Chromium desktop interaction tests                                                   |
| `npm run test:offline`        | Production cache reload tests with the origin server stopped                                         |
| `npm run format`              | Format source, styles and documentation                                                              |
| `npm run audit:apis`          | Read live API formats, CORS headers and route letters; writes `docs/api-audit.json`                  |
| `npm run icons`               | Regenerate PNG Home Screen icons from the source SVG                                                 |
| `node scripts/live-smoke.mjs` | Full live download smoke test against an already running localhost:5173 dev server; up to 15 minutes |

## Data behavior

- The Web Worker downloads and normalizes operator catalogues off the main thread. IndexedDB holds one atomic snapshot per operator, with routes, stops and reverse stop-to-route indexes.
- Weekly age checks happen at launch, resume, reconnection and hourly while open. iOS cannot be relied on to execute weekly jobs while a web app is closed. The next active session performs overdue work.
- Four requests per operator run concurrently for fan-out downloads. Retry/backoff handles transient failures. Checkpoints resume interrupted downloads; current snapshots stay untouched until replacements are complete.
- ETA uses the network, updates every minute while visible, and is never cached by the service worker. KMB/Citybus results are filtered by direction and stop sequence; NLB timestamps are parsed in Hong Kong time.
- Bookmarks and language are stored locally, separately from replaceable route snapshots. Export/import provides a portable backup. No cloud sync is implemented. Storage can still be removed by the user or operating system.
- Group names are user-defined: add stops from any routes to the same named group to compare their ETAs together.
- Nearby search requests location only after a tap, filters to 1 km, sorts by distance, and never transmits coordinates. Up to 40 closest stops are shown.

## Documentation

- [API research and download strategy](docs/API-RESEARCH.md)
- [Live API audit evidence](docs/api-audit.json)
- [Requirements and implementation status](docs/REQUIREMENTS-AND-STATUS.md)

The app uses the public datasets published through [DATA.GOV.HK](https://data.gov.hk/en-datasets/category/transport). Route changes and estimates remain under the operators' control. Interface references: [Apple's design guidance](https://developer.apple.com/design/tips/). Platform references: [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/), [Home Screen storage separation](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/), and [Safari 26 web apps](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).

## Source structure

```text
src/
  App.tsx                 # Entry point only
  app/                    # Provider, shared context, screen composition
  pages/                  # Saved, Routes, Nearby, Settings, Route Details
  components/
    arrivals/             # ETA presentation
    bookmarks/            # Save/group dialog
    catalog/              # Download cards and operator progress
    illustrations/        # Decorative UI
    layout/               # Header, page heading, tab bar
    routes/               # Custom keypad, route badge and route row
  hooks/                  # Feature state and side effects
  services/
    api.ts                # Live arrivals and HTTP retries
    catalog/              # Operator importers and on-demand route details
  storage/                # Local preferences and IndexedDB migrations
  types/                  # Domain and worker-message types
  utils/                  # Pure helpers and their tests
  i18n/                   # English and Traditional Chinese
  styles/                 # Global and application styles
  workers/                # Background import message handler
```

Existing data is preserved when upgrading to IndexedDB schema version 2. Complete operator snapshots remain separate from the lightweight Citybus route index and individually downloaded route details.
