# Project review — 12 November 2026

Reviewed the application composition, hooks, pages/components, operator adapters, catalogue worker/storage,
joint and timetable matching, backup boundaries, styles/accessibility, PWA/version configuration, publisher,
development scripts and regression coverage using the code-review-skill. The starting point was clean `main`
after pulling upstream commit `57dc427`. This is a bounded source and local-fixture review, not proof that
every possible defect is absent.

## Findings and changes

| Priority | Finding                                                                                                                                                                                                                                                             | Resolution                                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2       | A backup could pass validation with null/malformed route-stop entries, inconsistent stop IDs or invalid coordinates, then fail when opened. Derived joint membership also survived validation/export.                                                               | Validate nested identities, safe positive sequences, unique sequence numbers and coordinate ranges; discard derived partners without changing valid legacy bookmark IDs, order or preferences. |
| P2       | Backup import captured bookmarks before awaiting file contents. Removing/editing bookmarks during that read could be undone when import completed.                                                                                                                  | Merge with the latest session value through a functional update; retain imported conflict and preference precedence.                                                                           |
| P2       | Renaming the last bookmark in a selected group left an invisible active filter and an empty Saved view.                                                                                                                                                             | Use All whenever the selected group no longer exists.                                                                                                                                          |
| P2       | HTTP errors thrown inside the retry block retried permanent failures. Transient responses incurred two delays, including a delay after the final attempt; the app ignored HTTP-date Retry-After. Publisher storage failures could also repeat a successful request. | Share bounded retry handling between app and publisher, retry only recoverable failures and keep checkpoint writes outside network retries.                                                    |
| P2       | Operator normalization coerced null/blank coordinates into zero and snapshot construction accepted invalid or duplicate stop sequences.                                                                                                                             | Reject malformed operator inputs before snapshot commit; retain the previous snapshot and existing explicit missing-metadata placeholders.                                                     |
| P2       | The lockfile contained high/moderate security advisories in development dependencies.                                                                                                                                                                               | Apply compatible security updates and targeted patched minimatch/glob overrides without downgrading ESLint or the PWA toolchain.                                                               |
| P2       | Routes download Retry skipped failed providers when their retained snapshots were still fresh.                                                                                                                                                                      | Force explicit retries, matching Settings and initial download, while reusing interrupted checkpoints.                                                                                         |
| P3       | Earlier development guidance required displaying untimed ETA messages, conflicting with the intentional version 1.0.4 behavior and its regressions.                                                                                                                 | Reconcile the guidance; preserve hidden untimed messages and displayed timed remarks.                                                                                                          |

The existing module boundaries, worker-based full imports, conservative operator matching and user-controlled
service-worker activation fit the application. No broad architecture rewrite or ETA matching change was justified.
English/Traditional Chinese copy and the current three-departure presentation remain intact.

## Dependency review and remaining advisory

The initial npm audit reported 14 affected packages (two high, nine moderate, three low). Compatible updates
refresh ESLint/Wrangler and transitive fast-uri, undici and zod. Overrides select minimatch 11.0.8 for affected
modern versions and glob 14.0.5 within workbox-build. minimatch 5 used by filelist is unaffected and unchanged.
The fixed upstream ranges are documented in the
[minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) and
[glob advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). Remove overrides when upstream dependency
ranges incorporate the fixes, after running lint/toolchain, production build and offline/update checks.

The final audit still reports four low-severity affected packages from **one** underlying
[unpatched deepmerge advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), through
`vite-plugin-pwa → workbox-build → @rollup/plugin-node-resolve → deepmerge`. The advisory lists no patched
release, and npm reports 4.3.1 as the latest. It concerns malicious merge inputs. In this project the observed
consumer merges its own static default plugin options; deepmerge is not an application runtime dependency.
This limits the observed exposure but does not establish that all possible build inputs are safe. Keep build configuration and
dependencies trusted. A forced PWA-toolchain downgrade is not an appropriate automatic fix. This remains an
explicit upstream dependency limit; the review does not claim a clean full npm audit. The separate production-only
audit (`npm audit --omit=dev`) reports zero vulnerabilities.

Decision: application findings are addressed; the low-priority upstream dependency follow-up remains.

## Verification

New regressions cover malformed/legacy backups, discarded membership, delayed imports with concurrent removal,
group edits, HTTP retry timing/budgets and normalization failures preserving the prior snapshot. See
[requirements/status](REQUIREMENTS-AND-STATUS.md) for final command results and platform limits.

No new live operator API audit, physical iPhone check, published screenshot refresh or deployment was performed.
