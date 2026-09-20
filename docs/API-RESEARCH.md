# Hong Kong bus API research

Verified 20 September 2026. Starting catalogue: https://data.gov.hk/en-datasets/category/transport

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

Observed union: **A B C D E F G H K M N O P R S T W X** (18 letters). No I, J, L, Q, U, V, Y or Z in the sampled catalogues. Digits 0–9 are always present. The UI derives letters again from downloaded route numbers, so new operator codes do not require a release. Before downloads finish, use this verified union as a fallback. A reproducible crawl script is included at `scripts/audit-apis.mjs`.

## Storage and refresh design

Normalize to provider-prefixed stop IDs, variant route IDs, route stop arrays and a reverse stop-to-route index. Store complete provider snapshots in IndexedDB. Download and normalization run in a Web Worker. Persist successful intermediate responses for seven days so interrupted Citybus downloads resume without repeating thousands of requests. A force refresh starts a new generation and reuses its checkpoints on retry. Commit each provider snapshot atomically only after all its relationships and stop details are fetched. Failed providers keep their previous snapshot and timestamp.

Initial download starts automatically. Weekly refresh is checked at launch, on becoming visible, and periodically while active. Existing routes and live ETA remain available during updates. iOS does not promise background execution while a PWA is closed or suspended: refresh resumes the next time the app is active. Manual refresh and each provider's last successful download time appear in Settings. HTTPS is required for service workers and phone geolocation. ETA is network-only, refreshed each minute while visible, with stale/error state kept explicit.

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

Evidence: `citybus-n8p-audit.json` contains timestamps, complete route/stop responses and ETA responses for both directions. Reproduce with `node scripts/audit-citybus-route.mjs N8P`; this reads public operator data and replaces that route's audit file. ETA timestamps are historical observations, not current predictions. No route-data reset or bookmark migration is necessary for the fix.
