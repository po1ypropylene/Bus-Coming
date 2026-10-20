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
  top edge; one masked bottom layer fades content below navigation. The search shell omits that layer.
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
or touch. The mobile keypad hides navigation immediately and restores it when hidden; it does not
morph the bar. Header state uses IntersectionObserver. Compact route navigation appears after its
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
