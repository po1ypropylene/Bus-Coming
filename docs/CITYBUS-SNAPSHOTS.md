# Shared Citybus catalogue

The app can download a complete Citybus catalogue from Cloudflare Static Assets instead of repeating thousands of
operator requests on every device. A separate, assets-only Worker named `bus-coming-citybus-data` serves the files.
The weekly publisher does not deploy the application. KMB, NLB, TD joint membership and live ETA adapters are unchanged.
No KV, R2, paid Worker plan or Cloudflare Cron Trigger is required.

## Set up publishing

1. Commit/push this change to the GitHub repository's default branch. Scheduled workflows run from that branch.
2. In Cloudflare, create a scoped API token with **Account → Workers Scripts → Edit**, restricted to the account that
   will host the data Worker. Copy the account ID from the dashboard. Do not put the token in source or chat.
3. In GitHub **Settings → Secrets and variables → Actions**, add repository secrets `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID`. Add repository variable `CITYBUS_PUBLISH_ENABLED` with value `true`.
4. Run **Actions → Refresh Citybus catalogue → Run workflow**. This first collection still takes time, but only the
   publisher performs it. A failed crawl never reaches the deployment step. The first deployment creates the separate
   data Worker; its name is in `cloudflare/citybus.wrangler.jsonc` and can be changed before enabling the workflow.
5. Find the data Worker's HTTPS address in Cloudflare. Add GitHub variable `CITYBUS_MANIFEST_URL`, for example
   `https://bus-coming-citybus-data.YOUR-SUBDOMAIN.workers.dev/manifest.json`. Subsequent runs retain the previous
   snapshot file so clients holding its manifest can finish downloading it during a deployment.
6. Set `VITE_CITYBUS_CATALOG_URL` to that same manifest URL in your **application build environment**. This is a public
   URL, not a secret. It must be present when Vite builds; setting it only as a runtime Worker binding has no effect.
   For Cloudflare Git-connected Workers Builds (build command `npm run build`, deploy command
   `npx wrangler deploy`), open the **app Worker → Settings → Builds → Production**. Scroll to the **Variables and
   secrets** section inside Builds and add a plain-text build variable named
   `VITE_CITYBUS_CATALOG_URL`, with the complete manifest URL from step 5 as its value. Save it, then trigger a new
   production build (for example, retry the latest production build or push a new commit to `main`). Merely redeploying
   previously built files does not incorporate the variable. Keep the existing build/deploy commands. This variable
   belongs to the app Worker's build settings; it is separate from the general runtime Variables and Secrets section
   and from GitHub's `CITYBUS_MANIFEST_URL`. A separate custom data domain is optional.
7. Check the manifest returns JSON, and its referenced snapshot returns JSON with `Access-Control-Allow-Origin: *`.
   On a new browser profile, Settings should reach Citybus **Ready offline** after the shared download. On an existing
   profile, use manual data refresh. Verify a Citybus route, saved stop and offline search without clearing user data.

The workflow runs Sundays at **03:23 Hong Kong time**, and supports manual runs. Concurrent publishers are serialized.
It has a 90-minute job timeout. GitHub standard runners are free for public repositories; private repositories consume
included Actions minutes. Public scheduled workflows can be disabled after 60 days without repository activity.
Check GitHub run failures and periodically check the manifest timestamp. A stale publisher does not manufacture a fresh
source timestamp: the client rejects snapshots at least seven days old and uses the existing official importer.

## Local generation and manual publication

Use Node 22.12+ and `npm ci`. Run `npm run catalog:test` for isolated publisher fixture checks. Run
`npm run catalog:generate` to collect data into `.citybus-public/`. The generator bundles
the app's existing Citybus normalizer with Vite, so route identity and stop normalization stay consistent. It limits
concurrency to four and retries with backoff/Retry-After handling. Successful raw responses are saved in
`.citybus-checkpoints/`; a retry within 24 hours resumes that interrupted generation. Completed generations clear their
checkpoints; subsequent runs fetch the operator again. Checkpoints are ignored by Git and are local to a runner:
GitHub retries on a new runner start from scratch. These raw files contain public operator data only.

For a subsequent publication, set `CITYBUS_PREVIOUS_MANIFEST_URL` to the deployed manifest URL before generating.
A 404 allows first publication; other failures to retrieve/verify the previous generation stop publication.
Never manually deploy output from a failed run. The successful generator replaces `.citybus-public/` only after all
validation and previous-generation retention succeed.

Authenticate Wrangler with `npx wrangler login` on your machine, then use `npm run catalog:deploy`. Alternatively supply
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` through your secure environment. Tokens are publisher-only and never
included in the browser build. Use the workflow for routine updates; avoid competing manual deployments while it runs.
To disable publishing, set `CITYBUS_PUBLISH_ENABLED=false` or disable the workflow. To return clients to direct operator
imports, remove `VITE_CITYBUS_CATALOG_URL`, rebuild and redeploy the app. Neither operation resets IndexedDB or
bookmarks.

## Contract and failure behavior

`manifest.json` contains schema version 1, the collection-start timestamp in milliseconds, a content-addressed snapshot
filename, SHA-256 and UTF-8 byte length. Snapshots contain normalized Citybus routes/stops and schema version 1. The
client validates timestamps, identities, names, coordinates, sequence ordering, references, byte count and hash, and
rebuilds the reverse stop index. Repeated stop visits and leading-zero stop IDs remain intact. Empty upstream directions
are omitted by the existing normalization. The timestamp records collection time, not an invented operator revision.

The app checks on the existing weekly schedule and on manual refresh, reuses an equal/newer local snapshot without
fetching the body, and atomically commits validated replacements to the existing IndexedDB snapshot store. It never
clears bookmarks, preferences or databases. Missing, corrupt, stale or incompatible shared data falls back to the
existing official importer, including early search, on-demand details and checkpoint resumption. If both sources fail,
the previous snapshot remains usable and the existing bilingual refresh error is shown. A storage failure propagates
without starting another network crawl. No new user-facing messages are introduced.

Static snapshot files have long-lived immutable caching; the manifest revalidates. Both are CORS-enabled. The data
Worker has no executable request handler and no HTML fallback. Generation refuses files larger than 24 MiB, below
Cloudflare's 25 MiB per-asset limit. One previous snapshot is retained on each publication. Very old manifest URLs may
404 after later releases; clients safely retry through the official importer.

## Free-tier references

- [Cloudflare Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/):
  directly served assets have free unlimited requests and no additional storage charge.
- [Cloudflare platform limits](https://developers.cloudflare.com/workers/platform/limits/): per-file asset limit and
  free Worker compute limits, which are avoided by collecting outside the Worker.
- [Static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/): `_headers` support.
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
- [GitHub workflow inactivity](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows).

## Verification

See requirements/status for actual local verification. Cloudflare deployment, a full current live Citybus crawl and
physical iPhone validation must be recorded separately; fixture tests do not prove those external steps.
