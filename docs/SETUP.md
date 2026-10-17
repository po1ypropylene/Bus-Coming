# Development setup and deployment

For everyday use, see the [README](../README.md). For code conventions and architecture, see the
[development guide](DEVELOPMENT.md).

## Run locally

Requires Node 22.19+ within the 22.x line, or Node 24.11+, and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Initial launch downloads real operator data into IndexedDB. Citybus route search becomes
available as soon as its small route index loads; opening a route loads its stops on demand. Configure
the [shared Citybus catalogue](CITYBUS-SNAPSHOTS.md) to download a prepared Cloudflare snapshot. Without that
configuration, the full Citybus offline catalogue still requires thousands of individual requests. KMB/NLB download
independently. Download progress is in Settings. Existing downloaded data stays usable during updates.

```sh
npm run build
npm run preview
```

The production build in `dist/` includes the service worker; development deliberately does not register one. Host
`dist/` at the root of an HTTPS origin. Direct operator downloads need no API key or paid service. Optional shared
Citybus publishing uses a GitHub workflow and a scoped Cloudflare deployment token; see the setup guide.

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
| `npm run typecheck`           | Native TypeScript 7 type checking                                                                    |
| `npm run typecheck:watch`     | Continuous native type checking alongside the development server                                     |
| `npm run preview`             | Serve production build locally                                                                       |
| `npm run lint`                | Oxlint general/TypeScript rules, ESLint React and Prettier checks                                    |
| `npm test`                    | Data normalization, ETA filtering, backup validation and toolchain regression checks                 |
| `npm run test:e2e`            | WebKit mobile + Chromium desktop interaction tests                                                   |
| `npm run test:offline`        | Production cache reload tests with the origin server stopped                                         |
| `npm run format`              | Format source, styles and documentation                                                              |
| `npm run audit:apis`          | Read live API formats, CORS headers and route letters; writes `artifacts/api-audit.json`             |
| `npm run icons`               | Regenerate PNG Home Screen icons from the source SVG                                                 |
| `node scripts/live-smoke.mjs` | Full live download smoke test against an already running localhost:5173 dev server; up to 15 minutes |

## Updating the installed iPhone app

Deploy the complete new `dist/` build to the same HTTPS origin. The production app checks for a new service worker at startup, on return to the foreground, on reconnection, and hourly while active (automatic resume checks are throttled to once per minute). Settings also has **Check for app updates**. When the new version has downloaded, tap **Update and reload**. This reloads the app without clearing bookmarks, preferences or route data. Unsaved form edits are not retained across reload, so finish them first.

The Home Screen app has its own running page and offline cache; opening Safari does not reload that page. Older installations without the new update controls need a one-time bootstrap: after deployment, open the Home Screen app online, allow time for the new worker to download, fully close it from the app switcher, then reopen it. Close any other windows of the same installed app too. If the old screen persists, repeat after the download has had time to complete and check hosting cache headers. Do not clear website data or delete the installed app as an update procedure.

Configure hosting/CDN response headers: `/sw.js`, `/index.html`, `/` and the manifest should revalidate (`Cache-Control: no-cache`); hashed `/assets/*` files can use `public, max-age=31536000, immutable`. Serve `/sw.js` as JavaScript, never the HTML fallback. Deploy atomically and retain old hashed assets during rollout. Purge stale CDN copies of HTML/service-worker files when needed. These are hosting instructions; this repository cannot configure an unspecified external hosting provider.

Run `npm run build && node scripts/update-smoke.mjs` to exercise a three-release production update in isolated Chromium and WebKit profiles. `npm run test:offline` verifies offline reload independently. Physical Home Screen lifecycle behavior still needs an iPhone check.

## Platform references

- [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [Home Screen storage separation](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/)
- [Safari 26 web apps](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
