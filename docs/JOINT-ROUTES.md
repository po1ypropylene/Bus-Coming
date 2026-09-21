# Jointly operated routes

Implemented 21 September 2026. The former manually maintained registry and its one-off evidence JSON have been removed.
Joint membership comes from Transport Department open data; there is no route-number allowlist in the application.

## Official source

- [TD bus route dataset](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson)
- [CSDI dataset](https://portal.csdi.gov.hk/geoportal/?datasetId=td_rcd_1638844988873_41214)
- [Dataset metadata](https://portal.csdi.gov.hk/geoportal/rest/metadata/item/td_rcd_1638844988873_41214)
- [Public FeatureServer query](https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1638844988873_41214/FeatureServer/0/query)

GET the query endpoint with these URL-encoded parameters:

```text
f=json
where=COMPANY_CODE IN ('KMB+CTB','LWB+CTB')
outFields=OBJECTID,COMPANY_CODE,ROUTE_NAMEE
returnGeometry=false
orderByFields=OBJECTID
resultOffset=0
resultRecordCount=1000
```

Read `features[].attributes.ROUTE_NAMEE`, deduplicate, and paginate while `exceededTransferLimit` is true. Encoding `+`
correctly is essential. Neither an API key nor a backend proxy is needed. Live verification on 21 September 2026
returned 190 direction/variant records covering 90 route numbers and confirmed browser CORS. Dataset membership can
precede or lag operator catalogues; only currently available operator records can be paired. The TD route feed is not
itself an ETA feed.

## Lifecycle and storage

`services/joint/catalog.ts` runs inside the existing catalogue worker, independently of the operator downloads. It
persists the normalized membership and successful download timestamp under `td-joint-routes-v1` in the existing
IndexedDB `responses` store. No database version or bookmark schema change is needed. This key is outside operator
checkpoint URL namespaces, so their cleanup does not delete it.

Startup restores the last successful membership. Refresh uses the existing seven-day policy, resume/reconnection checks
and Settings refresh button. Downloads do not block search or ETAs. Settings displays the TD download timestamp and
failures. Empty, malformed, failed or incomplete paginated responses never replace the previous catalogue. On the first
launch without TD data, routes remain separate until valid membership arrives. iOS cannot refresh while it suspends the
app.

## Journey and stop matching

1. TD must explicitly designate the number as KMB+CTB or LWB+CTB. Number equality alone is never sufficient: the
   unrelated KMB and Citybus **2X** remain separate.
2. Pair only KMB's standard service (`service === '1'`) with a unique Citybus journey. Match both translated endpoints
   after punctuation/spacing normalization. When endpoint spelling differs, complete stop data can establish the same
   journey through at least three unambiguous ordered matches covering at least 70% of the longer stop list. Ambiguous
   pairs and special KMB services stay separate.
3. Never equate provider `O`/`I` codes. The live **106** fixture has KMB outbound paired with Citybus inbound; **102**
   uses matching bounds. Both directions are tested.
4. Match stops using unique visits and mutual nearest candidates along the paired journey. The distance threshold is
   60m, or 150m for matching normalized bilingual stop names. Reject alternatives within 10m of the best candidate,
   repeated stop IDs, missing metadata, and matches that cross route order. This is conservative geographic inference,
   not an official provider-stop crosswalk.
5. Preserve each operator's stop ID, bound, service and original sequence for its ETA call. Existing KMB strict
   filtering and Citybus's N8P unique-stop sequence exception remain intact.

`jointPartners` is derived session data on route objects. The search list uses one KMB-led row; either operator filter
includes it. The original route IDs remain indexed so old Citybus and KMB bookmarks continue to resolve without
migration or rewriting. New bookmarks strip derived partners. Stored backup fields never authorize membership: the
current TD catalogue does.

The detail itinerary includes partner-only/unmatched stops between neighboring common stops (or appended when no
ordering anchor exists), retaining their operator identity internally. Visible numbering is itinerary order, while ETA
requests and bookmarks retain API sequences. On-demand Citybus details work before its full snapshot completes. Stops
not safely paired show their available operator arrivals with an explicit partial-data notice. Nearby results retain
physical provider stop entries; opening either can show combined ETAs.

## Arrivals and failures

`services/joint/arrivals.ts` requests each operator independently and combines successful predictions chronologically.
Equal-time predictions are retained because they can represent different buses. Operator labels remain available on each
prediction; null-ETA remarks sort after timed predictions. The UI keeps the existing three-prediction limit and minute
refresh cadence.

A failed request or unmatched stop shows a bilingual partial-data notice while retaining successful results. If all
requests fail, the existing stale/unavailable behavior applies. Errors are retried on the normal ETA cadence or refresh
action. Empty but successful ETA responses are valid; do not invent arrivals for a formally joint route where only one
operator currently runs a service.

## Maintenance and limits

- No manual route JSON to update. If TD changes its service URL/fields, update the adapter and parser tests. Keep the
  last good cache on upstream failures.
- Some event-only joint operations may be absent from the TD dataset and stay separate. Do not infer them from shared
  numbers.
- Geographically ambiguous stops, loops with repeated visits, special service variants and insufficiently overlapping
  journeys deliberately remain separate or partial. Do not loosen matching just to remove a notice.
- Endpoint-name matches work with Citybus's early index. Journeys needing geographic evidence wait for complete stop
  catalogues; this does not block normal route search.
- Real 102/106 route/stop fixtures in `src/services/joint/fixtures/` were fetched from both official operator APIs on 21
  September 2026. They are regression evidence, not a membership registry or runtime data. The test suite does not
  access live APIs.
- Unit coverage includes reversed bounds, stop sequence offsets, ambiguous/repeated/remote stops, 2X exclusion, service
  variants, combined ordering, failures, on-demand details, weekly/forced refresh, pagination and cache retention.
  Browser coverage exercises joint search, operator filtering, partner-only stops, existing Citybus bookmarks, new
  bookmarks, reload, translations and 2X isolation.
- Physical iPhone validation and exhaustive checking of every joint service remain manual.
