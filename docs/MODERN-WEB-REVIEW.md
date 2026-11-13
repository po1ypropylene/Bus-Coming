# Modern web review — 13 November 2026

Reviewed the web entry point, application composition, pages and reusable controls, client hooks,
network/import boundaries, persistence and PWA configuration against modern-web-guidance. Consulted
`accessibility`, `dialog`, `light-dismiss-a-dialog`, `forms`, `css`, `performance`, `security` and
`ime-safe-enter-submit`. This is a bounded source and fixture-based review, not a certification of
every best practice or every browser/device combination.

## Findings addressed in 1.3.7

- The save sheet had no accessible name or programmatic association between its group input and hint.
  It now references its visible heading and hint using per-instance IDs.
- Clicking sheet padding dismissed the form because the old handler treated any click targeting the
  dialog itself as a backdrop click. Native `closedby="any"` handles light dismissal where supported.
  Safari retains a feature-detected pointer fallback requiring both press and release outside the
  sheet's geometry. Padding and text-selection drags ending outside do not dismiss it.
- The native dialog closes before unmounting, allowing native focus restoration. Initial field focus
  uses the actual DOM autofocus property: React's imperative `autoFocus` occurs before `showModal()`
  and does not provide the native dialog's initial-focus hint on reopening in Strict Mode.
  There is no custom focus trap or Escape handler. Overscroll containment on the sheet and backdrop
  is progressive enhancement; no body/root scroll lock changes layout or glass compositing.
- Screen changes previously retained only the brand as the browser title. Titles now identify the
  current tab or selected route/destination and update with the language.
- The operator button group now has group semantics for its existing accessible label. Saved-group
  and save-sheet chips expose pressed state; the keypad toggle exposes expanded state. The route
  controls use the native search landmark and disable spelling/correction of route identifiers.
- The marker-free bookmark ordering list explicitly retains list semantics for Safari.

All new accessible names reuse existing English/Traditional Chinese copy. Native implicit form
submission remains intact; no custom Enter handler was added, so IME candidate confirmation remains
the browser's responsibility.

## Scan findings and deliberate retention

The whole-repository `legacy-scan . --json` reported two dark-mode findings in `app.css` and
`glass.css`. Both meet its drop rubric: `index.css` already enables `color-scheme: light dark` on
`:root`. Cross-file tokens and existing media overrides are valid; replacing them just to satisfy
the scan would add risk without fixing a defect. The scanner checks 33 guides / 35 deterministic
rules, roughly 20% of the guidance catalogue; it is not a complete audit.

- **Safari glass:** preserve the prefixed/unprefixed backdrop-filter pair, opaque defaults,
  contrast/transparency overrides, small SVG filter on inert label copies, fresh filter identities,
  map caching and frame-budget degradation. No changes to material tokens, `SelectionLens`,
  `glass.css`, paint boundaries, filter regions, safe areas or theme palettes were needed.
  Do not introduce containment, opacity, isolation or transforms on glass ancestors as an unmeasured
  performance optimization. See [glass constraints](GLASS.md).
- **Startup/performance:** retain the small synchronous preference bootstrap to avoid painting the
  wrong glass mode. Module scripts are deferred by default. Full imports and timetable parsing stay
  in the worker, with progressive Citybus search/details and old snapshots usable during refresh.
  System fonts avoid a font download chain. Do not apply speculative content visibility to ETA
  panels; their visibility also controls live polling.
- **Updates/data:** preserve the versioned precache and explicit waiting-worker activation contract
  rather than replacing it with generic caching examples. Live ETA remains network-only with bounded
  in-memory reuse and explicit stale states. No storage keys, schemas, backups or operator filters
  change, and no data is cleared.
- **Security/privacy:** source searches found no application use of `innerHTML`, `outerHTML`,
  `dangerouslySetInnerHTML`, `document.write` or `eval`. React renders operator/user strings as text;
  imports and shared snapshots retain validation and size limits. Public API URLs use HTTPS;
  geolocation remains user-initiated and local. Worker messages are not cross-window messaging.
  Production response headers belong to the hosting configuration, which is not supplied for the
  app in this repo. CSP/reporting, HSTS, framing and permissions headers require host verification;
  no invented reporting endpoint or untested policy was added. Any future CSP must allow the actual
  worker, catalogue origins and generated lens images and retain Nearby geolocation. The optional
  Citybus publisher has separate hosting configuration. Existing dependency limits remain documented
  in [project review](CODE-REVIEW.md). Fresh `npm audit` checks on 13 November confirmed zero
  production advisories and four low-severity build-tool reports tracing to the same deepmerge
  issue; no high/moderate reports or dependency changes were introduced.

## Verification and limits

See [requirements/status](REQUIREMENTS-AND-STATUS.md#modern-web-review--13-november-2026) for the
completed checks. Browser regressions use replayed fixtures, not current live operator responses.
Chromium and emulated WebKit checks cannot establish installed Safari or physical iPhone blur,
VoiceOver, large text, GPU performance or Home Screen behavior. Published screenshots were not
regenerated and no deployment was performed.
