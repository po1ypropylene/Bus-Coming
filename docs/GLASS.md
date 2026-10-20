# Safari glass controls

Implemented 20 October 2026 from the supplied `liquid-glass-safari-pwa-spec.md` guide.

The app owns its glass rendering. It adds no rendering dependency, copies no scrolling page content,
and never applies an SVG URL through `backdrop-filter`. CSS blur/saturation/brightness, transparent
fills, inset highlights and a masked hairline rim provide the large material. The small DOM lens uses
`feImage` and `feDisplacementMap` on inert highlighted control labels. It does not refract the page
behind the navigation. This follows [Aave's filter-on-content technique](https://aave.com/design/building-glass-for-the-web)
and avoids the unsupported path tracked by [WebKit bug 245510](https://bugs.webkit.org/show_bug.cgi?id=245510).

## Ownership

- `styles/glass.css`: shared tokens, ambient backdrop, matte content, control materials, safe areas,
  scroll edges, touch feedback and accessibility fallbacks. The observed header material provides the
  top edge; a short bottom fade covers only the gap below navigation, preserving the actual content
  backdrop behind the tab capsule. The search shell omits that layer.
- `components/glass/SelectionLens.tsx`: small cached opaque PNG displacement maps, integer filter
  regions, sRGB, transformed filter target, fresh filter identity on resize/press/selection, retirement
  of previous filters one animation frame later, a clipped source graphic, JS spring with clamped time steps and no CSS
  transitions on the refracted labels. The label row uses a local layout offset to keep it in the
  source paint layer; the lens wrapper moves by transform. Maps regenerate on size changes, not during position animation.
- `utils/glass.ts`: validation, defaults, map cache, spring and two-second frame-budget guard.
- `hooks/useGlass.ts` and `public/glass-bootstrap.js`: apply validated preferences before the app
  paints, then react to preference and system contrast/transparency changes. The bootstrap script is
  included in the production precache. Startup tolerates unavailable storage.
- `GlassSettings`: bilingual intensity slider, mode selector, native accessible refraction switch,
  live preview and session-degradation notice. Theme swatches use a highlight ring.

The optional `glass` field in `bus-coming-user-v1` contains `intensity` (finite number 0–1), `mode`
(`auto`, `full`, `reduced`) and `refraction` (boolean). Missing settings use 0.45/auto/true. Invalid
explicit settings reject the backup through the existing validation boundary. There is no schema,
key or IndexedDB change. Existing backups and bookmarks remain usable. Export/import includes
explicit glass preferences. The nonportable performance decision is stored in sessionStorage as
`bus-coming-lens-degraded`, not in user backups; blocked sessionStorage falls back to in-memory state.

The bar's real buttons remain keyboard/VoiceOver targets; decorative copies are inert and hidden
from accessibility. Dragging snaps to the nearest tab. Scroll minimisation restores on upward scroll
or touch. The mobile Search screen keeps navigation visible with the keypad open or closed. Navigation
occupies a separate, non-shrinking row in the viewport flex layout, below the keypad; only the results
scroll. The safe-area padding belongs to the search shell and is not counted again on the bar. Header state uses IntersectionObserver. Compact route navigation appears after its
expanded heading passes. Buttons inside material surfaces use fill and rim without another blur.
No optional pinned-ETA accessory, gyro permission, haptics, menu system, sheet detents or decorative
empty-state refraction was added.

## Verification and remaining limits

Automated checks use fixture data; they do not establish current live API behaviour. Unit regressions
cover old backups, invalid settings, preference round trips, filter IDs, spring stability and the slow
frame-budget decision. Browser regressions exercise preferences, both appearances, five themes,
keyboard/drag navigation, keypad visibility, filter nesting and backdrop transmission. A rendered-pixel comparison against a single-label reference catches
incorrect source-graphic bounds that otherwise paint the first label in the active lens. The material
and real hit targets are siblings, and the tested screens use at most four visible backdrop surfaces.

Physical iPhone Safari and installed standalone PWA validation is still required. In particular:

- iOS status-bar coverage, safe areas, home-indicator clearance and landscape cutouts;
- rounded blur clipping and masked scroll edges during long-list scrolling;
- actual lens refraction, filter-cache refresh, no composited label strips and no flicker;
- contrast over bright moving content at both intensity extremes in all five themes;
- iPhone 12/13-class scroll performance, automatic degradation under sustained slow animation;
- VoiceOver, large text, on-device reduced effects/motion and installed-app update delivery.

Playwright WebKit is browser emulation, not a physical iPhone result. Earlier repository probes found
that this runtime declared backdrop support without screenshot blur; transmission and computed CSS
are not proof of physical Safari blur. Pixel transmission is measured separately from actual blur.

### Recorded checks

For this change set, formatting, lint, 119 unit tests across 20 files, toolchain probes and the production
build passed. The full Chromium/WebKit browser suite passed 93 tests with one expected WebKit skip
(the Chromium-only Lighthouse audit). Lighthouse reported 100 for all four tabs and route details in
both languages. All five theme/appearance accessibility checks passed. After the final small-lens paint
correction, all 16 focused glass/settings/header checks passed, including both engines' new rendered
label-reference comparison. These automated scans do not replace worst-backdrop or hardware checks.

The final production offline and update smoke checks passed in both Chromium and WebKit: offline
shell reload, stored bookmarks, cached route search/timetables, explicit update activation and preference
preservation. Outputs remain in ignored `artifacts/` and `test-results/`. No live operator audit,
physical-device validation, push or deployment was performed.

### Operator colours and clearer bottom glass — 20 October 2026

Version 1.3.1 restores matte operator badge fills in both appearances: KMB red, Citybus yellow and
NLB blue. Shared fill/ink tokens also colour the operator selector; they do not follow the selected
app accent and remain present with reduced glass effects. The original glass rewrite accidentally
removed the badge colour declarations rather than just removing their gloss.

The bottom fade now covers only the gap below the tab capsule. Its previous broad background tint
and blur muted content before the tab material sampled it. The capsule uses a lighter intensity-based
veil (4–26%), a shorter blur (8–16px), a quieter rim/sheen and a more transparent selection fill.
The header material is unchanged. Reduced effects and unsupported-browser defaults remain solid.
Browser transmission checks place their underlay at ordinary content depth, below the bottom fade,
so they cannot bypass that layer. Badge regressions check all five app accents, both appearances,
full/reduced modes, distinct opaque operator hues and at least 4.5:1 badge text contrast.

Verification for 1.3.1: 119 unit tests, lint, formatting and production build passed. The full browser
suite passed 99 tests with one expected WebKit Lighthouse skip; this includes the operator badge
matrix and stronger rendered transmission checks. Production offline and update smoke checks passed
in both engines. Physical Safari appearance, standalone safe areas and hardware performance remain
unverified.

### Search navigation correction — 20 October 2026

Version 1.3.2 removes the guide's hide-on-keypad behaviour. Opening Search previously added
`keypad-open` and set the entire mobile tab bar to `display: none`; the keypad is open by default.
This directly accounts for the reported disappearance in an installed PWA. The tab bar now stays
visible and usable beside the custom keypad, with its own reserved viewport row. The mobile main
area no longer reserves additional fixed-bar padding, avoiding overlapping or double-counted space.
The original hiding rule and the test-helper workaround that silently hid the keypad before leaving
Search are removed. New regressions switch directly from Search to other tabs with the keypad open,
repeat visits, exercise hide/show, and check geometry at 320×568, 390×844 and 440×956 with and without
synthetic top/bottom safe areas. Production offline smoke checks also assert visible navigation and
no keypad overlap after opening Search. Emulation does not establish physical iPhone validation.

Verification for 1.3.2: lint, formatting, production build, 119 unit tests, 26 focused navigation/UI
checks and both engines' production offline/update smoke checks passed. The full browser run passed
101 cases with one expected skip; two existing short-screen cases were then corrected for subpixel
grid rounding (less than 0.2px) and passed in both engines on rerun. The new regressions require the
keypad and tab bar to occupy separate non-overlapping rows. Screenshot review confirmed Search with
the keypad and bottom navigation visible together. Physical iPhone retesting remains outstanding.
