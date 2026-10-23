# Requirements and implementation status

Last updated: 23 October 2026. This is the current behavior and verification scope; Git retains earlier implementation
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
route plates, softly highlighted content cards, translucent search/keypad controls and a frosted save sheet. Header and
tab chrome use backdrop blur and a translucent tint, with a stronger material on sheets. It follows all five theme
palettes and system light/dark appearance. Reduced-transparency and higher-contrast preferences use opaque surfaces;
unsupported backdrop-filter browsers retain opaque defaults. Features, text, data contracts and navigation behavior
are unchanged.

- Route details prefix the destination heading with **To / 往** in the selected language.
- All panels sort supplied predictions chronologically before taking the first three. Equal-time departures remain
  distinct; untimed operator messages are hidden.
- Intervals up to one minute, including negative estimates, display **Due / 就到** at the same size as numeric predictions. Operator refreshes
  determine when predictions disappear. Overdue predictions are not proof that a bus has passed.
- Hong Kong clocks, operator remarks and relative fetch age remain visible. All predictions use equal-width horizontal
  columns, including different destinations or remarks. Mobile countdowns shrink to fit narrow panels; clocks and
  supplied descriptions remain beneath their prediction, with longer notes wrapping within each column.
- Mixed departure destinations appear automatically. Tap an ETA card to show or hide supplied destinations,
  including when they are all the same. The choice lasts until the card remounts (including language changes); refresh/retry do not toggle it.
  Keyboard activation and English/Traditional Chinese accessibility labels are supported. Missing destinations stay absent.
- Requests run only for visible cards in a focused, visible, online document. After each completed request, the next
  check is scheduled in 15 seconds for successful, non-partial results with one or two timed predictions; full cards,
  empty results, partial results and failures use 30 seconds. A 15-second memory cache and request deduplication limit
  automatic calls. Manual refresh/retry bypasses completed cached responses for every matched operator, sharing any
  active request. Automatic callers join an active refresh rather than reuse older cached data. Existing requests may
  finish after focus is lost. Failed, partial,
  offline or older-than-90-second results are explicitly stale; retries preserve known predictions.
- KMB retains exact direction/service/sequence matching. Citybus uses stop identity and direction for unique visits,
  retaining exact sequences for repeated/unknown visits because ETA sequences can differ from catalogue sequences.
  NLB timestamps are parsed as UTC+08:00; `departed` does not mean the bus passed the requested stop.
- No routes, GPS positions, departure destinations or arrival estimates are invented. Missing KMB stop metadata keeps
  an explicit placeholder and original sequence, without entering GPS results. Missing/null ETAs show supplied remarks
  or an unavailable state.

## App versions and updates

`package.json` is the single app-version source. Settings displays the full Semantic Version, and production
service-worker cache identities use the same value. Agents automatically advance patch/minor/major once per
completed shipped change set according to compatibility; see [versioning rules](DEVELOPMENT.md#app-versions).
The UI offers an update after the new worker has downloaded successfully, with activation and reload controlled
by the user. Changes to bundled assets also trigger detection through precache hashes. Backup and database schema
versions remain independent of app release numbers.

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
- Header pixel checks cover uniform light/dark backgrounds across both viewport gutters and a simulated
  62px top safe area and a continuous full-viewport bottom divider on Settings and Routes at 320px, 440px and 1280px widths in both browser engines.
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
The published README includes four framed iPhone 17 previews refreshed on 23 October 2026 with installed
Safari 27.0.1, including the device-frame rendering. App content renders at 393×852 CSS pixels with Safari’s native
2× backing scale; framed PNGs are normalized to 1533×2904 pixels. All four Traditional Chinese, blue, light/dark
saved-stop and route views were visually reviewed after catalogue loading, fonts, finite animations and a
three-second settling delay. Safari reported full glass effects, translucent surfaces and active backdrop blur;
these checks do not establish physical iPhone rendering. Formatting, lint, build, 119 unit tests and toolchain
probes passed for this refresh. These documentation changes do not change the shipped app version.
Route 8P/118 records, stops and ETAs were captured from public operator APIs on
17 October at approximately 17:53 HKT, with official TD joint membership for 118. The renderer replays the dated
responses; the preview ETA values are not current service predictions. A separate public TD capture on
23 October retained four normalized 8P timetable patterns and their referenced stops/calendars for the loaded
variant picker. Source files reported Last-Modified 14 October. Both page and worker requests use replayed
fixtures during rendering, preventing later live downloads from changing the images. Sources and reproduction
commands are in
[development](DEVELOPMENT.md#generated-output-and-regression-fixtures).
Production offline smoke passed in Chromium and WebKit, including cached reload, bookmark/search preservation,
the blue default for older preferences and the blue manifest. The README previews use desktop Safari at mobile
dimensions; the other checks use browser emulation. Neither establishes physical iPhone, deployment, GPU-performance or VoiceOver validation.

WebStorm formatting setup was also verified on 17 October 2026: Reformat Code followed by Save left the keypad TSX
and application CSS byte-for-byte unchanged; Reindent followed by Save also preserved the TSX file. Project Prettier
handles reformat/save, and EditorConfig sets four-space continuation indentation. Build, lint, formatting, 67 unit
tests and toolchain probes passed again. Browser/offline checks were not repeated for these editor-only settings.

Version-source validation on 17 October 2026 passed production build, lint, formatting, 72 unit tests, toolchain
probes and 59 browser cases, with the intentional WebKit Lighthouse skip. The new browser check verifies the full
package version in the Settings footer in both languages. Production offline and update smoke checks passed in
Chromium and WebKit. The update smoke serves three simulated version-derived cache identities of the same built
shell, verifying waiting-worker detection, explicit activation/reload, current-build status, resume detection and
preference preservation. This is local browser evidence, not deployment or physical iPhone verification.

Header-divider and horizontal-ETA validation on 18 October 2026 passed production build, lint, formatting,
72 unit tests and toolchain probes. Browser verification covered 59 passing cases across Chromium and mobile WebKit,
with the intentional WebKit Lighthouse skip; the mixed-service case passed a targeted rerun after adding waits for
language-triggered ETA reloads. Divider pixels match across both viewport gutters in light/dark appearance with a
simulated safe area. Mixed-service countdowns remain horizontal without overflow at 320, 390, 440 and 1280px in both
languages, with destinations and remarks retained. The mobile mixed-service screenshot was reviewed. Production
offline and update smoke checks passed in both engines for version 1.0.2. No new live API, deployment or physical
iPhone validation was performed.

Version 1.0.4 hides untimed operator messages, including repeated Citybus “KMB Cycle” rows, and removes the
“Message from Citybus” blocks. Timed remarks such as “Final Bus” remain under their departures. Responses with only
untimed rows show the standard bilingual no-estimate state. Operator adapters and matching are unchanged.
Regression responses are constructed fixtures, not a new live API capture. Build, lint, formatting, 72 unit tests,
toolchain probes and 61 browser cases passed, with the intentional WebKit Lighthouse skip. Production offline and
update smoke checks passed in Chromium and WebKit; the mobile screenshot was reviewed. No deployment or physical
iPhone validation was performed.

Glass refinement in version 1.0.5 replaces the tab bar's 88% surface tint with 62% in light appearance and 58%
in dark appearance, with a restrained sheen. The header now shares a full-width backdrop material; controls, selections,
sheets and toasts use coordinated materials while content cards remain readable. This follows Apple's current
[materials hierarchy](https://developer.apple.com/design/human-interface-guidelines/materials), implemented in CSS;
it is not the native iOS Liquid Glass renderer or verified iOS 27 parity.

Build, lint, formatting, 72 unit tests, toolchain probes and 65 browser cases passed, with the intentional WebKit
Lighthouse skip. New light/dark rendering checks measure actual colour transmission through the tab bar, exercise all
tabs and higher-contrast fallback, and capture sheets. Existing checks cover all five palettes, both appearances,
accessibility, header gutters/simulated safe areas and navigation clearance. Production offline and update smoke checks
passed in Chromium and WebKit. Light/dark screenshots were reviewed.

The automated WebKit runtime reports backdrop-filter support and transmits the tint but does not render blur in its
screenshots. A separate minimal striped-backdrop probe reproduced this outside the app: a 20px blur left the sampled
stripe range at 153–255, whereas Chromium flattened it to 204. This is a test-runtime observation, not evidence that
physical Safari lacks backdrop filters. Chromium screenshots show the intended frosted rendering. Physical iPhone blur,
scrolling performance, system transparency settings and native iOS 27 visual parity remain unverified. No deployment
was performed.

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

Version 1.1.0 adds a card-wide destination toggle while retaining automatic mixed-destination labels.
Verification on 20 October 2026 passed build, lint, formatting, 72 unit tests and toolchain probes, plus
production offline and update smoke checks in Chromium and WebKit. Destination regressions cover route details
and saved stops, repeated taps, Enter/Space, expanded-state labels in both languages, refresh preservation and
missing destinations. Across the suite and isolated reruns, 65 browser cases passed with the intentional
WebKit Lighthouse skip. Slow fixture-clock assertions were stabilized; interrupted and artifact-collision runs
were completed with isolated output and sequential reruns. The expanded mobile screenshot was reviewed.
No new live API, deployment or physical iPhone validation was performed.

Version 1.1.1 reduces client refresh delays: manual refresh/retry bypasses the short completed-response
cache for all matched operators, and successful cards with one or two predictions recheck after 15 seconds.
Full cards, empty responses, partial results and failures use 30 seconds. In-flight requests remain shared;
foreground/visibility/online checks, source filtering and stored user data are preserved. This cannot supply
predictions absent from the selected stop's operator response.

Verification on 20 October 2026 passed build, lint, formatting, 77 unit tests and toolchain probes.
The full browser suite plus targeted reruns covered 67 passing cases and the intentional WebKit Lighthouse skip.
An existing age assertion initially drifted while screenshots were taken; freezing its test clock fixed it,
and both engines passed the rerun. New regressions cover immediate manual refresh inside the cache window,
shared refresh requests, third-column replenishment after 15 seconds, return to 30-second polling, empty
responses and a missed browser focus event. Production offline and update smoke checks passed in Chromium
and WebKit. No new live API audit, deployment or physical iPhone validation was performed.

## Citybus route variants — 20 October 2026

Standalone Citybus route details offer an English/Traditional Chinese variant selector from the official TD
timetable only when at least two distinct patterns are safely matched to the selected direction. Automatic selects the earliest scheduled origin departure within 60 minutes, or the next
scheduled variant within 14 days when none qualifies. Operating weekdays, holiday exceptions,
after-midnight service times and frequency periods use Hong Kong time. Opening a saved/nearby stop
restricts automatic candidates to variants serving its safely mapped operator stop. Every safely
matched pattern for that direction remains manually selectable, including outside its operating hours;
the manual choice lasts while the route screen is open. The operator stop list remains an explicit
choice and the fallback while data is missing, unavailable or cannot be matched safely.

Variant stops retain the operator route, bound and sequence for ETAs and bookmarking. Full circular
patterns display the whole loop. Unmatched or ambiguous TD visits stay visible but cannot request
arrivals or be saved. Existing bookmarks, backups, IndexedDB schema, joint-arrival aggregation and
operator ETA filters are preserved. Variant selection does not filter shared-stop live predictions by
an unverified trip identity. KMB/LWB and NLB keep their existing service selection behavior.

The independent worker import caches a complete validated timetable for offline use, refreshes weekly
and through Settings, and retains saved data on failure. Its timestamp/error is visible in Settings.
The origin-based window can switch before a bus already en route reaches an intermediate stop; the UI
labels the origin explicitly, and missing intermediate times are not fabricated. At least three ordered
operator visits are needed to associate a TD pattern with a direction; short/ambiguous patterns fall
back to operator data. Physical iPhone performance and official-app implementation parity remain
unverified.

Verification for 1.2.0: formatting, lint, build, 94 unit tests and the toolchain probes passed. The complete
Chromium/mobile-WebKit browser run had 71 passes, one intentional WebKit Lighthouse skip and two failures
from the old global Settings error-count assertion after the new timetable status row was added. That
assertion now scopes the three operator rows; all 20 relevant refresh, direction, joint, progressive
Citybus and variant rechecks passed in both engines. All six final variant checks also passed after the
mobile wording/heading adjustment, including axe AA checks, manual/default selection, automatic clock
changes, Chinese controls, original bookmark identities and cached timetable restoration. Production
origin-stopped offline reload (including real 720 variants) and explicit update/reload/preference/resume
smoke checks passed in both engines. These are browser-engine checks, not physical iPhone validation.

## Route variant regression fixes — 20 October 2026

Version 1.2.1 restores the previous route UI when the selected direction has zero or one distinct
routing pattern: no Automatic/Operator list/single-pattern block, no variant loading/error footnote,
and no timetable replacement of the operator destination or stop list. Opposite directions do not
count as alternatives. Multiple TD records with identical ordered stops count as one pattern, with
combined schedules. The 720 multi-pattern selector and its 60-minute default rule remain available.

Joint journeys keep the existing merged operator itinerary, partner-only stops, combined arrival
panels and saved-stop identities. Timetable overlays are disabled when either TD joint membership
or existing operator pairing establishes a joint route; this also protects details while a partner
catalogue is still loading. Joint variants remain unsupported rather than replacing the merged
journey with an incomplete CTB-only timetable. Existing cached timetable and user data are preserved.

Verification for 1.2.1: 99 unit tests and toolchain probes, type checking/build, lint and formatting
passed. All 26 relevant Chromium/mobile-WebKit browser cases passed, including both directions of
real-data 2X/102 with loaded timetable caches, original destination headings and stop counts,
partner-only stops, combined arrivals, legacy bookmarks, direction switching, zero/single/duplicate
pattern UI in both languages, and retained 720 automatic/manual variants. Production offline and
update/reload/preference/resume smoke checks passed in both engines. The fresh Citybus audit covered
static route/stop data; browser ETA responses were fixtures. No deployment or physical iPhone check
was performed.

## Safari glass controls — 20 October 2026

The control layer now uses shared translucent glass tokens, top-left rims and a static ambient
backdrop. Cards, ETAs, route rows and badges remain matte. The floating tab bar has a spring-driven,
draggable SVG selection lens over a highlighted copy of its labels; the operator selector shares the
small-lens renderer. Navigation stays visible while the mobile route keypad is open or closed, in a separate
reserved row below the keypad. Scroll minimisation, an observed scroll-state header and a compact
route header keep navigation above the content. See [GLASS.md](GLASS.md) for implementation and limits.

Settings includes bilingual Clear–Tinted intensity, Auto/Full/Reduced mode and a refraction switch.
Preferences preserve existing bookmarks, themes and version-one backups. Increased contrast and
reduced transparency resolve Auto to solid controls. Reduced motion removes lens spring motion and
press scaling. A two-second slow-animation budget disables refraction for the current browser session.
The PWA status-bar style is black-translucent; safe-area/device rendering still requires real hardware.

Verification: formatting, lint, 119 unit tests, toolchain probes and production build passed. The full
browser suite passed 93 tests with one expected WebKit Lighthouse skip; after the final lens-paint
correction, 16 focused glass/settings/header tests passed, including rendered label alignment in both
engines. Final production offline and update smoke checks passed in Chromium and WebKit. Physical
iPhone standalone rendering, bright-backdrop contrast and hardware performance remain unverified.

## Operator badge and bottom glass correction — 20 October 2026

Version 1.3.1 restores distinct matte KMB red, Citybus yellow and NLB blue badges in both light and
dark appearance, independent of app theme or glass mode. The bottom capsule has a lighter tint,
shorter blur and more transparent selection. The bottom background fade is limited to the gap below
the capsule, so real scrolling content remains visible through it. Header glass is unchanged.

Verification for this correction: formatting, lint, production build, 119 unit tests and the full
Chromium/WebKit browser suite passed (99 passed; one expected WebKit Lighthouse skip). Operator
badge colour/contrast and the stronger content-depth transmission checks passed in both engines.
Production offline reload and explicit update/preference-preservation smoke checks also passed in
both engines. No live API audit or physical iPhone verification was performed.

## Search navigation availability — 20 October 2026

Version 1.3.2 fixes the mobile tab bar disappearing on entry to Search. The prior hide-on-keypad CSS
rule hid navigation immediately because Search opens its keypad by default. Search now reserves
separate space for navigation below the keypad, with independent result scrolling and no additional
fixed-bar clearance. Users can switch directly to Saved, Nearby or Settings without hiding the keypad.
The keypad toggle no longer changes navigation availability. No stored-data change or reset is needed.

Verification: lint, formatting, production build, 119 unit tests, production offline navigation and
update smoke checks passed. All 26 focused navigation/UI checks passed. The full browser run passed
101 cases with one expected WebKit Lighthouse skip; its two short-screen cases initially failed on
less-than-0.2px grid rounding. After adding a 1px tolerance to that shared-edge assertion, both cases
passed on targeted rerun. The new navigation/keypad overlap assertions remain strict. Synthetic
safe-area geometry and browser emulation do not establish physical iPhone standalone validation.

## Initial operator selection — 21 October 2026

Version 1.3.3 fixes the missing All selection capsule on first entry to route search. The shared lens
now measures its direct DOM parent when the host ref has not yet attached during the initial child
layout effect. Operator changes and return visits retain the same selection behavior. No stored data
or operator API behavior changes.

Verification: lint, formatting, production build, 119 unit tests and toolchain probes passed. The new
first-entry/operator-switch/return-visit regression passed in Chromium and mobile WebKit. Production
offline reload and explicit update/preference-preservation smoke checks passed in both engines.
The full browser suite passed 105 cases with one expected WebKit Lighthouse skip when run with one
worker. Initial overlapping runs collided on trace artifacts and exhausted test-machine memory;
the complete sequential rerun passed. Physical iPhone rendering was not tested.

## Compact route header alignment — 21 October 2026

Version 1.3.4 places the scrolled route header's back button on the left. Equal-width side columns
keep the route number and destination centred within the capsule. Long titles retain ellipsis, and
the back control retains its translated accessible name and 44px touch target.

Verification: formatting, lint, production build, 119 unit tests and toolchain probes passed. All six
focused header checks passed in Chromium and mobile WebKit, including English/Traditional Chinese
alignment at 320px, 440px and 1280px, overflow and back navigation. Production offline reload and
explicit update/preference-preservation smoke checks passed in both engines. The full browser suite
passed 107 cases with one expected WebKit Lighthouse skip using one worker. No live API audit or
physical iPhone validation was performed.

## Back button follows the compact header curve — 22 October 2026

Version 1.3.5 removes the compact route header's left inset. Its circular back control now spans the
52px bar height and meets the left edge, sharing the capsule's 26px curve. Equal side columns keep
the route number and destination centred. The control retains its translated accessible name and
keyboard behavior; long titles still truncate without horizontal overflow.

Verification: production build, formatting, lint, 119 unit tests and toolchain probes passed.
Production offline reload and explicit update/preference-preservation smoke checks passed in
Chromium and WebKit. Browser geometry checks cover the matching left/top edges, circular control,
full bar height, centred title, 44px minimum target and back navigation in both languages at
320px, 440px and 1280px. The captured mobile WebKit result was visually reviewed. An initial run
caught a misplaced test screenshot step; it was corrected before the final browser run. A subsequent
runner received SIGTERM before completing; the final single-worker rerun passed 107 browser tests
with one expected WebKit Lighthouse skip. No live API audit or physical iPhone validation was performed.
