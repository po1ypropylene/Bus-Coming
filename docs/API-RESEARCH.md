# Hong Kong bus API research

Initial catalogue checks: 20 September 2026, with later targeted observations dated below. These are historical, not current guarantees. Starting catalogue: https://data.gov.hk/en-datasets/category/transport

## Sources and scope

- KMB / Long Win: https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb
- KMB specification: https://data.etabus.gov.hk/datagovhk/kmb_eta_api_specification.pdf
- KMB dictionary: https://data.etabus.gov.hk/datagovhk/kmb_eta_data_dictionary.pdf
- Citybus: https://data.gov.hk/en-data/dataset/ctb-eta-transport-realtime-eta
- Citybus specification: https://www.citybus.com.hk/datagovhk/bus_eta_api_specifications.pdf
- Citybus dictionary: https://www.citybus.com.hk/datagovhk/bus_eta_data_dictionary.pdf
- NLB: https://data.gov.hk/en-data/dataset/nlb-bus-nlb-bus-service-v2
- NLB specification: https://www.nlb.com.hk/datagovhk/BusServiceOpenAPIDocumentation2.0.pdf

All selected endpoints use public HTTPS GET JSON, without API keys. Company namespaces must remain separate: KMB/LWB share an API; Citybus uses CTB; NLB uses numeric route IDs. New World First Bus services are now in CTB.

## KMB and Long Win

Base: `https://data.etabus.gov.hk/v1/transport/kmb`

| Endpoint                                                   | Purpose                                     |
| ---------------------------------------------------------- | ------------------------------------------- |
| `/route/`                                                  | All direction/service variants              |
| `/stop`                                                    | All stops, bilingual names and coordinates  |
| `/route-stop`                                              | All ordered route/stop relationships        |
| `/route/{route}/{outbound or inbound}/{service_type}`      | One route variant                           |
| `/route-stop/{route}/{outbound or inbound}/{service_type}` | One variant's stop list                     |
| `/stop/{stop_id}`                                          | One stop                                    |
| `/eta/{stop_id}/{route}/{service_type}`                    | Arrivals for selected stop/route            |
| `/stop-eta/{stop_id}`                                      | All arrivals at stop (optional alternative) |
| `/route-eta/{route}/{service_type}`                        | Route-wide arrivals (optional alternative)  |

Use the first three bulk endpoints for initial download. Join by route number, bound (`O`/`I`), service_type and stop ID. Sort sequence numerically. Preserve service variants and repeated stops. ETA must be filtered by direction AND stop sequence, not just route number. Missing/null ETA means unavailable; display the operator remark rather than inventing minutes. ISO ETA includes Hong Kong offset. Metadata is updated daily and ETA approximately every minute.

Live route crawl: **1,599 direction/service records**. Letters: **A B C D E F H K M N P R S T W X**. The source does not give a separate reliable LWB company field; the UI labels this provider “KMB / LWB” rather than guessing ownership from a prefix.

## Citybus

Base: `https://rt.data.gov.hk/v2/transport/citybus`

| Endpoint                                        | Purpose                              |
| ----------------------------------------------- | ------------------------------------ |
| `/route/CTB`                                    | Complete route catalogue             |
| `/route/CTB/{route}`                            | Route endpoints                      |
| `/route-stop/CTB/{route}/{outbound or inbound}` | Ordered stop IDs for a direction     |
| `/stop/{six_digit_stop_id}`                     | Bilingual stop names and coordinates |
| `/eta/CTB/{stop_id}/{route}`                    | Arrivals; filter by `dir` and `seq`  |
| `/company/CTB`                                  | Company metadata (optional)          |

There is no documented all-stops bulk endpoint in this API. Fetch both directions per route, deduplicate stop IDs, then fetch each stop once. A direction can be empty for a circular/one-way route. Reverse displayed origin/destination for inbound. Keep IDs as strings to preserve leading zeros. Respect HTTP 429 and limit download concurrency.

Live route crawl: **406 route numbers**. Letters: **A B C D E G H K M N O P R S T X**.

## New Lantao Bus

Base: `https://rt.data.gov.hk/v2/transport/nlb`

| Endpoint                                                                          | Purpose                                         |
| --------------------------------------------------------------------------------- | ----------------------------------------------- |
| `/route.php?action=list`                                                          | Route catalogue; `routeId` identifies a variant |
| `/stop.php?action=list&routeId={id}`                                              | Ordered stops, bilingual names and coordinates  |
| `/stop.php?action=estimatedArrivals&routeId={id}&stopId={id}&language={en or zh}` | English / Traditional Chinese arrivals          |

Preserve `routeId`; `routeNo` alone is ambiguous. Stop array order is the sequence. Names use `_e` and `_c`, unlike the other APIs. ETA field is `estimatedArrivalTime`; parse the timezone-less string explicitly as `+08:00`, including when the phone is abroad. `routeVariantName` and `message` carry useful service information. `departed` means departed from the origin, NOT passed the requested stop; do not filter it out. No synthetic GPS interpretation is made from the confusing `noGPS` field.

Live route crawl: **64 variants**. Letters: **A B H M N P R S X**.

## Custom keypad

Observed union: **A B C D E F G H K M N O P R S T W X** (18 letters). No I, J, L, Q, U, V, Y or Z in the sampled catalogues. Digits 0–9 are always present. The UI derives letters again from downloaded route numbers, so new operator codes do not require a release. Before downloads finish, use this verified union as a fallback. Run `npm run audit:apis` to reproduce the catalogue check; output goes to ignored `artifacts/api-audit.json`.

## Storage and refresh design

Normalize to provider-prefixed stop IDs, variant route IDs, route stop arrays and a reverse stop-to-route index. Store complete provider snapshots in IndexedDB. Download and normalization run in a Web Worker. Persist successful intermediate responses for seven days so interrupted Citybus downloads resume without repeating thousands of requests. A force refresh starts a new generation and reuses its checkpoints on retry. Commit each provider snapshot atomically only after all its relationships and stop details are fetched. Failed providers keep their previous snapshot and timestamp.

Initial download starts automatically. Weekly refresh is checked at launch, on becoming visible, and periodically while
active. Existing routes and live ETA remain available during updates. iOS does not promise background execution while a
PWA is closed or suspended: refresh resumes the next time the app is active. Manual refresh and each provider's last
successful download time appear in Settings. HTTPS is required for service workers and phone geolocation. ETA is
network-only, checked every 15–30 seconds while its card is visible and the document is focused, with stale/error
state kept explicit. See the development guide for sparse-card scheduling and manual cache bypass. Client polling
does not guarantee that an operator regenerates predictions at that rate.

## UI and platform references

Apple touch/layout guidance: https://developer.apple.com/design/tips/ and https://developer.apple.com/design/human-interface-guidelines/

Use system typography, safe areas, 44px minimum controls, large titles, grouped settings, tab navigation, light/dark appearance and reduced-motion support. Real-device Safari/Home Screen verification remains necessary in addition to WebKit emulation.

## Live integration findings

The reproducible audit confirmed `Access-Control-Allow-Origin: *` on the selected endpoints. Full KMB bulk download returned 6,740 stop records and 36,261 route-stop links. Two links (269B outbound service 4 sequence 6; 269X outbound service 1 sequence 5) reference `50C1510101650C40`, absent from the stop catalogue; its individual stop endpoint also returned an empty object. The importer attempts individual lookup for missing stops. If metadata remains unavailable, it preserves the sequence using an explicitly labelled placeholder, excludes that stop from GPS results, and still permits querying its operator ETA endpoint. This avoids either discarding whole routes or blocking all KMB data. The placeholder is not a fabricated location.

The initial live run also exercised download resumption across development reloads: committed KMB/NLB snapshots survived, and successful Citybus requests were reused from IndexedDB checkpoints.

## Progressive Citybus availability

The complete offline snapshot can take many minutes. `route/CTB` is now saved immediately as a separate lightweight route index, so Citybus routes appear in search without waiting for the complete stop catalogue. The route-details service fetches the selected direction and its unique stop details on demand, reusing the background import's persisted responses. It saves that route independently for subsequent/offline visits. A provisional index includes both candidate directions; if the operator publishes an empty direction, the detail screen says so. The complete snapshot later removes empty directions. This does not mark an incomplete dataset as a completed offline download or advance its successful-download timestamp.

## Citybus ETA sequence mismatch — N8P, 21 September 2026

A targeted live audit around 03:28 HKT reproduced missing inbound ETAs. N8P's catalogue origin is Siu Sai Wan (Island Resort), destination Wan Chai (Harbour Road); the requested Wan Chai → Siu Sai Wan direction is **I**.

- `/route-stop/CTB/N8P/inbound` numbers 18 stops from 1 to 18.
- `/eta/CTB/002424/N8P` identifies the same Wan Chai origin stop with `dir: I`, but `seq: 12`, not catalogue sequence 1.
- All 18 inbound stops returned three non-null ETAs with sequence **catalogue + 11** (12–29). The previous shared KMB/Citybus sequence filter dropped every row.
- For outbound, the first 11 catalogue stops returned matching sequences and outbound ETAs. The catalogue additionally listed eight trailing stops for which the audit returned no outbound ETA rows. Do not relabel inbound rows as outbound or invent estimates for those entries. This observation is not enough to rewrite the operator's published stop list.

Citybus selection now verifies direction and the route/stop/company fields when supplied by its stop-specific endpoint. For a stop that appears exactly once in the selected direction's catalogue, its stop ID determines the visit, so a different ETA sequence does not discard valid rows. Repeated stops, incomplete stop lists and invalid selected sequences retain exact sequence matching. KMB retains its exact direction/service/sequence filter; NLB is unchanged. No N8P-specific offset is hardcoded. Repeated-visit Citybus sequence inconsistencies remain conservative (may show no ETA rather than the wrong visit).

The historical capture is summarized above; unique/repeated-visit regression cases remain in `src/utils/transit.test.ts`. Reproduce with `node scripts/audit-citybus-route.mjs N8P`; this reads public operator data and writes timestamps, route/stop responses and ETA responses to ignored `artifacts/citybus-n8p-audit.json`. No route-data reset or bookmark migration is necessary for the fix.

## Transport Department joint-route membership — 21 September 2026

The public CSDI FeatureServer provides a small filtered JSON query for `COMPANY_CODE IN ('KMB+CTB','LWB+CTB')`, with
`ROUTE_NAMEE` identifying joint route numbers. The app now downloads and caches this source automatically. Live query
and browser CORS were verified: 190 records / 90 distinct numbers. These counts are dated evidence, not constants.
See [JOINT-ROUTES.md](JOINT-ROUTES.md) for the exact endpoint, parameters, pagination, cache lifecycle, direction
matching and conservative stop matching. Operator APIs still supply all ETAs.

Live route/stop snapshots for 102 and 106 are retained as test fixtures. 102 has 31/34 KMB stops and 31/36 Citybus
stops; 106 has 48/47 KMB stops and 47/48 Citybus stops, with opposite direction codes between operators. Shared numbers,
direction letters and sequence numbers therefore cannot be used as a cross-operator join key. These were current
catalogue checks, not an exhaustive live ETA audit.

## Shared Citybus snapshots — 6 October 2026

See [CITYBUS-SNAPSHOTS.md](CITYBUS-SNAPSHOTS.md) for the optional Cloudflare Static Assets publisher, manifest contract,
weekly GitHub workflow, build-time URL configuration, validation and official-import fallback. The publisher reuses
the Citybus normalizer. Existing IndexedDB schema, user data and ETA adapters remain unchanged.

## Departure destinations and overdue estimates — 16 October 2026

The [Citybus data dictionary](https://www.citybus.com.hk/datagovhk/bus_eta_data_dictionary.pdf),
section 2.5, documents `dest_en`, `dest_tc`, `rmk_en` and `rmk_tc` on each ETA row. The per-departure destination can
be more specific than the combined catalogue destination. Bus Coming now preserves these destination fields in the
selected language (also for KMB) and continues to retain operator remarks. There is no separate documented bypass-stop
list in the Citybus ETA contract; show routing descriptions when supplied in remarks, without inventing them.

Targeted public API reads on 16 October 2026 verified `/route-stop/CTB/720/outbound` (response generated at
21:48:20 HKT) lists stop `003156` at sequence 2. `/eta/CTB/003156/720` (generated at 21:48:41 HKT, row data timestamp
21:48:07) returned three outbound predictions at 21:51:21, 22:11:14 and 22:31:14, all with destination
`Central (Macao Ferry)` / `中環(港澳碼頭)` and empty remarks. This evening sample verifies the fields, not the morning
Wing Wo Street/bypass service or the original missing bus. Morning mixed-service browser fixtures are constructed from
the user's report, not a captured live morning response.

Removed the shared display cutoff that rejected `eta <= now - 60000`. Negative ETA alone does not establish that a bus
has passed the stop. The panel retains predictions until the operator replaces/removes them, displays intervals under
one minute as **Due / 就到**, and keeps the existing stale/error warning if refresh fails. Direction, service and
stop-selection rules are unchanged. Past predictions can remain visible with that warning during a network failure.

## ETA presentation update — 17 October 2026

The UI uses the existing normalized `remark`: KMB/Citybus adapters select `rmk_tc` / `rmk_en`, and NLB retains
`routeVariantName` or its response `message`. Scheduled and last-bus notes are displayed only when supplied in those
fields. No new live/scheduled flag, last-bus timetable or interpretation of NLB `noGPS` was added. These field names
were
verified in repository adapters and their fixtures for this change; no new live API audit was performed.

Polling now requests every 30 seconds for visible cards in a focused, visible, online document. This client cadence
does not imply the operator regenerates predictions that frequently. The relative age is time since the successful
client fetch, not a claim about the operator's source-data generation time. Absolute clocks remain in Asia/Hong_Kong.
The inclusive one-minute due label is now **Due / 就到**, following the user's requested full-size, shorter Chinese
label.
Direction/service/stop filtering and joint-provider aggregation are unchanged.

## Citybus departure classification audit — 17 October 2026

Ran `node scripts/audit-citybus-route.mjs 2X` and `node scripts/audit-citybus-route.mjs 720`
against the public API at approximately 11:28 HKT, covering both directions and every catalogue stop.
All returned ETA rows had empty `rmk_en`, `rmk_tc` and `rmk_sc`; none included a live/scheduled flag.
The July 2023 Citybus data dictionary, section 2.5 (rechecked on this date), documents no such flag.
The adapter already preserves these remarks when supplied, using the same display path as KMB.

- At outbound origin `003155`, 2X returned 11:32:00, 11:40:00 and 11:50:00; 720 returned
  11:30:00, 11:45:00 and 12:00:00. All remarks were empty.
- At intermediate outbound stop `001301`, 2X returned 11:28:20, 11:28:45 and 11:33:12;
  at `001303`, 720 returned 11:29:38, 11:43:06 and 11:58:06. All remarks were also empty.
- At 2X inbound origin `003415`, the response included 12:00:00, **12:02:32** and 12:14:00.
  Thus even origin predictions are not necessarily rounded to a whole minute.
- 720 again showed catalogue/ETA sequence differences. These observations do not change the existing
  unique-stop matching rule or establish that all first catalogue stops are active departure origins.

Citybus's [official app guide](https://www.citybus.com.hk/en/uploadedfiles/app_guide/en.html)
explains that ETA initially uses timetable/historical journey time and subsequently incorporates vehicle
position after departure. An intermediate-stop ETA can therefore still be timetable-based. Neither a
blank remark, stop position nor timestamp seconds establishes a particular departure's GPS status.
The guide describes additional vehicle-distance information in Citybus's own app; that information is
absent from the public ETA contract and these captures.

Raw responses are in ignored `artifacts/citybus-2x-audit.json` and `artifacts/citybus-720-audit.json`.
These are dated observations of the public API, not a verification of Citybus's private app data source.

The public route-search website was also inspected in a browser. Its 720 normal outbound journey at
Grand Promenade displayed **Scheduled** for 11:45, 12:00 and 12:15 (displayed update time 11:30:10).
This confirms the operator has richer information than the open-data response. Its downloaded `fb.php`
JavaScript's `showeta()` first calls `checkCall.php?type=eta` through a CAPTCHA-check branch, then loads
an HTML popup from `auto_c96d6235d5ee4b388e8db90a4aa5b7ab.php?l=...`. The active request does not pass
route/stop identity, suggesting server-side session context. This is not an established replacement API
for the static application; cross-origin integration and reliable departure matching remain unverified.

Static REA analysis of the downloaded HTML/JavaScript is retained as Evidence
`ev_f672b1a7c7299d46af712e6cc69846b385e95ce7edfe1e16e9ad68e47d46c7bd` (summary view
`ev_3fc300bf4c277a4770b6cc4bc773d08ebc7fb822de19e540b02b8a61e883b432`). Coverage is partial;
static analysis does not establish server behavior or native-app contracts. Source captures are ignored
under `artifacts/citybus-site/`. No departure classification or alternative data adapter was implemented.

A follow-up search of official public datasets also checked the Digital Policy Office's
[batch stop-ETA dataset](https://data.gov.hk/en-data/dataset/hk-dpo-datagovhk1-transport-bus-route-list-and-eta-spcific-bus-stop).
It aggregates the existing operator APIs. Its
[data dictionary](https://static.data.gov.hk/opendata/eta/bus-route-list-and-eta-specific-stop-api-data-dictionary.pdf),
page 11, explicitly marks `departed` and `noGPS` as **not applicable for CTB**. These fields therefore
cannot supply the missing Citybus classification. This follow-up verified documentation, not a new live
batch response. No suitable richer public source was established by the dataset, specification and
website checks; this is a bounded finding, not proof that no other source exists.

The user's decision is to require explicit source-backed status and never use approximate labels.
Stop position, timestamp rounding and ETA movement must not be used as classification heuristics.
Keep existing Citybus estimates and supplied remarks until a reliable source supports the distinction.

## Missing third prediction investigation — 20 October 2026

Ran `node scripts/audit-citybus-route.mjs 720` at 08:42 HKT after a report of two predictions at
outbound origin `003155` and three at the next stop `003156` around 08:36. At capture time both
stops supplied three predictions: 08:50/09:00/09:10 at the origin and 08:51:14/09:01:18/09:11:18
at the next stop. This later capture cannot establish what the API returned at 08:36.

The same audit captured outbound stop `001207` with only two timed rows (`eta_seq` 2 and 3),
08:47:31 and 08:56:06, while the next stop `001301` supplied three: 08:45:41, 08:51:01 and
08:59:14. Their source timestamps differed: 08:42:07 versus 08:41:08, respectively. Other stops
also supplied only two predictions. Thus adjacent stops can expose different prediction counts
and source generations directly in the public API; a downstream third estimate does not establish
that the upstream endpoint supplied it. Do not copy or extrapolate downstream times upstream.

The current adapter does not filter on `eta_seq`; the display removes untimed rows, sorts all
timed predictions, then limits to three. Added constructed browser and unit regressions for a
withdrawn first prediction, remaining rank gaps, two supplied predictions and subsequent replenishment.
The original screenshot event remains unconfirmed; no shipped matching or display change was justified.
Raw audit output is ignored at `artifacts/citybus-720-audit.json`.
