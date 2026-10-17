# Requirements and implementation status

Last updated: 17 October 2026. This is the current behavior and verification scope; Git retains earlier implementation
history. See [development](DEVELOPMENT.md) for architecture and invariants, [setup](SETUP.md) for local/phone testing and
deployment, and [API research](API-RESEARCH.md) for operator contracts and dated observations.

## Implemented behavior

| Area                     | Behavior                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operators                | KMB / Long Win, Citybus and New Lantao Bus; provider-specific route, direction, service and stop identities                                              |
| Languages and appearance | English and Traditional Chinese; five persisted theme colours with blue as default; system light/dark appearance                                         |
| Home Screen app          | Standalone manifest, install icons, safe areas, production offline shell and user-controlled app updates                                                 |
| Saved                    | Stop arrival cards, arbitrary named groups, edit/remove and persistent up/down ordering; filtering a group leaves other bookmarks in place               |
| Routes                   | Offline substring search with exact matches first, operator filters, paginated results and direction-specific stop lists                                 |
| Keypad                   | Catalogue-derived letters, reserved space for hidden letters, fixed number/action key positions, disabled invalid digits, clear/backspace and show/hide  |
| Direction switch         | Opens a uniquely matched opposite journey and clears expanded stops; preserves provider/service identities and handles NLB's separate route IDs          |
| Nearby                   | User-triggered location, permission/error state, accuracy and up to 40 closest stops within 1 km; coordinates remain on device                           |
| Settings                 | Language/theme, provider and TD download status/timestamps, manual refresh, backup export/import, installation and app-update controls                   |
| Catalogue downloads      | Automatic worker import, independent atomic provider commits, retry/backoff, resumable checkpoints and usable previous snapshots during refresh          |
| Citybus availability     | Early searchable index and on-demand cached route details before full import completes; optional validated shared snapshot with official-import fallback |
| Joint routes             | Automatic TD membership, conservative journey/stop matching, combined itineraries/arrivals, partial-data notices and preserved old bookmarks             |
| Weekly refresh           | Seven-day age checks at launch, resume, reconnection and hourly while active; no promise of execution while iOS suspends the app                         |
| Accessibility            | Keyboard focus, translated labels, reduced motion, at least 44px touch controls, 13px captions and measured theme contrast                               |

## Arrival correctness and presentation

The interface uses a CSS Liquid Glass-inspired finish: a floating capsule navigation bar, glossy operator-coloured
route plates, softly highlighted cards, search/keypad controls and a frosted save sheet. It follows all five theme
palettes and system light/dark appearance. Reduced-transparency and higher-contrast preferences use opaque surfaces;
unsupported backdrop-filter browsers retain opaque defaults. Features, text, data contracts and navigation behavior
are unchanged.

- Route details prefix the destination heading with **To / 往** in the selected language.
- All panels sort supplied predictions chronologically before taking the first three. Equal-time departures remain
  distinct; untimed operator messages follow timed predictions.
- Intervals up to one minute, including negative estimates, display full-size **Due / 就到**. Operator refreshes
  determine when predictions disappear. Overdue predictions are not proof that a bus has passed.
- Hong Kong clocks, operator remarks and relative fetch age remain visible. Different supplied destinations or remarks
  use rows; identical services use equal-width columns. Cards fit their content and longer notes expand naturally.
- Requests run every 30 seconds only for visible cards in a focused, visible, online document. A 15-second memory cache
  and request deduplication limit repeated calls. Existing requests may finish after focus is lost. Failed, partial,
  offline or older-than-90-second results are explicitly stale; retries preserve known predictions.
- KMB retains exact direction/service/sequence matching. Citybus uses stop identity and direction for unique visits,
  retaining exact sequences for repeated/unknown visits because ETA sequences can differ from catalogue sequences.
  NLB timestamps are parsed as UTC+08:00; `departed` does not mean the bus passed the requested stop.
- No routes, GPS positions, departure destinations or arrival estimates are invented. Missing KMB stop metadata keeps
  an explicit placeholder and original sequence, without entering GPS results. Missing/null ETAs show supplied remarks
  or an unavailable state.

## Data preservation

Bookmarks, language and theme are local to the browser/app, separate from replaceable route snapshots. Blue is the
default for new users and older records/backups without a theme. Explicitly saved colours, including green, remain
unchanged. The favicon and Home Screen icons use the blue brand. Older user data
and backups remain supported. Invalid imports do not overwrite existing data; valid imports merge by bookmark ID with
imported values winning conflicts. Existing positions remain, new IDs append in import order, and imported preferences
are restored. Exports preserve bookmark order.

IndexedDB schema version 2 preserves version-one snapshots and checkpoints while adding Citybus route-index/detail
stores. Refresh failures retain the last good snapshots and successful timestamps. Joint partners are derived from the
current TD catalogue, never trusted from backups or persisted as membership. A bookmark whose exact route/stop sequence
no longer exists shows unavailable and asks the user to save it again. App updates preserve localStorage and IndexedDB.

## Verification coverage

- Unit tests cover provider normalization/filtering, arrival ordering/destinations, route indexes and direction
  switching, keypad matching, backup validation/order, joint membership/matching/failures and snapshot validation.
- Retained 102/106 operator captures exercise real joint journeys, including opposite operator bounds on 106.
  `tests/fixtures.ts` supplies deterministic browser data. Fixtures are test inputs, not current live data.
- Chromium desktop and 440×956 mobile WebKit cover search, ETA, groups/order, reloads, imports, simulated GPS, progressive
  Citybus loading, migrations, failed refresh retention, joint routes, direction switches and both languages.
- UI checks cover compact cards/due labels, polling pauses/resume, health/retry states, keypad availability, narrow
  layouts, all-theme axe checks and token contrast. Lighthouse accessibility runs only in Chromium.
- Production offline and update smoke scripts separately exercise cached reload, bookmarks/search, update activation
  and preference preservation. Publisher fixture tests exercise normalization, hashes, headers, previous-generation
  retention and failed-publication safety.

Blue-default and README validation on 17 October 2026 passed build, lint, formatting, 72 unit tests, toolchain probes
and 53 browser cases, with one intentional WebKit skip for Chromium-only Lighthouse. Existing regressions confirm
unchanged keypad positions, navigation clearance, full-size due labels, bilingual headings, theme persistence,
bookmarks and route/ETA behavior. Lighthouse scored 100 on all five screens in both languages in blue/light
appearance; all-theme axe and token-contrast checks passed in both engines. Desktop Chromium and mobile WebKit
screenshots were reviewed in light/dark appearance. Additional checks exercised opaque higher-contrast chrome
in both engines, and reduced transparency, forced-colour selection and keyboard navigation in Chromium.
The published README includes four framed iPhone 17 previews at 402×874 logical pixels (3×), Traditional Chinese,
blue, and both appearances. Route 8P/118 records, stops and ETAs were captured from public operator APIs on
17 October at approximately 17:53 HKT, with official TD joint membership for 118. The renderer replays the dated
responses; the preview ETA values are not current service predictions. Sources and reproduction commands are in
[development](DEVELOPMENT.md#generated-output-and-regression-fixtures).
Production offline smoke passed in Chromium and WebKit, including cached reload, bookmark/search preservation,
the blue default for older preferences and the blue manifest. These checks and the README previews use browser
emulation, not physical iPhone, deployment, GPU-performance or VoiceOver validation.

WebStorm formatting setup was also verified on 17 October 2026: Reformat Code followed by Save left the keypad TSX
and application CSS byte-for-byte unchanged; Reindent followed by Save also preserved the TSX file. Project Prettier
handles reformat/save, and EditorConfig sets four-space continuation indentation. Build, lint, formatting, 67 unit
tests and toolchain probes passed again. Browser/offline checks were not repeated for these editor-only settings.

Historical live checks are summarized in [API research](API-RESEARCH.md): initial operator/CORS and full catalogue
checks on 20 September, targeted N8P and TD/102/106 checks on 21 September, and a targeted 720 evening response on
16 October. The 720 check did not reproduce the reported morning bypass service. One-off JSON reports and screenshots
are disposable; rerun the documented scripts when fresh evidence is required.

## Known limits and remaining manual checks

- **Physical iPhone:** Home Screen lifecycle, safe areas, real GPS permission, VoiceOver and large text require hardware
  checks. WebKit emulation and automated accessibility scores do not establish these or accessibility certification.
- **Citybus first download:** direct import needs hundreds of route-direction requests and thousands of stop requests.
  Search/details work early, but Nearby discovery needs a complete stop snapshot. See [shared catalogue setup](CITYBUS-SNAPSHOTS.md).
- **Local data only:** no accounts or cloud sync. Browser eviction, clearing data or reinstalling can remove saved data;
  export/import is the recovery path. Safari and Home Screen storage may differ.
- **Live service:** ETA needs a connection and depends on operator availability and accuracy. Every individual
  route/service variant has not been exhaustively validated.
- **Citybus live/scheduled labels:** the public API has no documented classification field. The 17 October
  2X/720 audit returned empty remarks at origins and intermediate stops. Citybus's own site displays richer
  status, but its separate website service is not integrated. See [the audit](API-RESEARCH.md#citybus-departure-classification-audit--17-october-2026).
- **Joint routes:** event services absent from TD stay separate. Special variants, repeated/ambiguous stops and
  insufficient overlap are not guessed; some journeys wait for full stop data. See [matching limits](JOINT-ROUTES.md).
- **Scope:** Nearby uses straight-line distances. Maps, walking directions, journey planning, fares and push
  notifications are not implemented.
- **Deployment:** the public app address is in the README. Hosting headers, current deployed behavior, the optional
  Cloudflare publisher deployment and a current full Citybus crawl are not established by local checks.
