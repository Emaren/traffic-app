# Traffic human-first production release — 2026-10-15

## Verified deployment receipt

| Component | Verified production state |
| --- | --- |
| Traffic API | `/var/www/Traffic/traffic-api`, commit `6a10fbd7785c7b0329bd7aa29ce9cf3d995860fd` |
| Traffic Web | systemd `WorkingDirectory=/mnt/HC_Volume_105319120/traffic-releases/web-6fc692d3c5581e2ca06e1a3567efbc084a047211` |
| Web source commit | `6fc692d3c5581e2ca06e1a3567efbc084a047211` (verified `git archive`) |
| Web build ID | `yA1bL7OAAA1lop0q2sPeQ` |
| API tests | 64/64 unittest cases passed on VPS |
| Web tests | 8/8 node tests passed on VPS |
| Web build | Next.js 16.1.6 webpack, TypeScript and page generation successful; about 239 MB |
| Web smoke | Staged localhost `127.0.0.1:3059`: HTTP 200 on `/`, `/visits`, `/projects/aoe2hdbets` |
| Activation smoke | Active localhost `127.0.0.1:3045`: all three routes passed; public homepage and `/api/healthz` passed |
| Services | `traffic-api`, `traffic-web`, `nginx` all active |

After activation, a localhost call to `/api/live-visitors?limit=25&history_limit=250&window_hours=24` returned `ok=true`, 24 human-first stream entries and 4,610 total stream records. Nonhuman previews contained:

| Preview | Group entries | Reported session memberships in groups |
| --- | ---: | ---: |
| Browser scripts | 7 | 782 |
| Known automation | 3 | 9 |
| Security/crawlers | 1 | 6 |
| Chain signals | 5 | 61 |
| **Visible preview sums** | **16** | **858** |

These are **preview memberships**, not a claim of 858 unique sessions across all categories or 858 IP addresses. Neither `stream_total` nor the 24 displayed people-first entries is a unique-human count. Browser-visible disclosure and hidden-tab reconnection were not manually exercised on a real browser in this terminal-only release.

## Why the frontend is staged, not checked out in place

The preserved `/var/www/Traffic/traffic-app` checkout remains at `225e976`, with its previous `.next` build. The active service instead uses a `700`-permission, `tony`-owned, immutable-by-convention release directory under the mounted volume.

- Shared `node_modules` is a symlink to `/mnt/HC_Volume_105319120/guided-node-modules/traffic-app/node_modules`.
- `.env.production` and `.env.production.local` in the staged release are symlinks back to the original `/var/www/Traffic/traffic-app` files; secrets are not copied into Git.
- `NEXT_PUBLIC_TRAFFIC_API_BASE_URL` was supplied at build time from the existing `/etc/traffic-web.env` configuration. Do not print private environment values in terminal receipts or commit them.
- The systemd drop-in `/etc/systemd/system/traffic-web.service.d/50-verified-release.conf` selects the staged `WorkingDirectory` while retaining the existing hardening and restart-memory guards.
- The legacy `scripts/deploy-traffic-web.sh` now refuses to run when systemd points at a different directory, avoiding a **successful-looking build of the inactive checkout**.

Do not fast-forward, delete, or rebuild the rollback checkout just to make `git status` look current. It is intentionally clean but behind the deployed web source. Existing tracked `origin/main` may lag an explicit HTTPS `FETCH_HEAD` until the next normal fetch.

## Boot and capacity checks

The volume is mounted via `/dev/disk/by-id/scsi-0HC_Volume_105319120` at `/mnt/HC_Volume_105319120` with `ext4 discard,nofail,defaults`. Systemd's effective `traffic-web.service` has both `Requires=mnt-HC_Volume_105319120.mount` and `After=mnt-HC_Volume_105319120.mount`, with `RequiresMountsFor` covering the active release. A missing volume can allow the VPS to boot while keeping the dashboard unavailable; a successful **reboot test was not performed**.

Observed filesystem capacity at closure: root volume 38 GB, 3.6 GB available (91% usage); mounted data volume 296 GB, 51 GB available (83% usage). Root disk needs a separate, read-only footprint audit before any cleanup. The server swapfile is also on this data volume.

## Repeatable release procedure

1. Verify exact source SHAs, clean worktrees, production services and resource headroom; repair narrow Git ownership defects *before* attempting checkout changes. Avoid running Git alternately as root and `tony`.
2. Deploy/test API first. For web, do **not** run the legacy in-place deployment script against the active staged-release service.
3. Fetch web source with an appropriate `tony` identity. When Git's configured SSH key is inaccessible under `/root/.ssh`, the public repo can be fetched over read-only HTTPS without modifying `origin`: `sudo -u tony env GIT_TERMINAL_PROMPT=0 git -c credential.helper= fetch --no-tags https://github.com/Emaren/traffic-app.git refs/heads/main`.
4. Compare fetched commit against an independently selected expected SHA. Extract it via `git archive` into a new private, versioned directory on the mounted volume. Do not overwrite the existing release directory.
5. Link dependencies and production env files, supply the existing `NEXT_PUBLIC_TRAFFIC_API_BASE_URL` at build time, run `npm test`, then `npm run build`. Verify `.next/BUILD_ID`; keep the root filesystem out of heavy build writes. Confirm runtime env is compatible.
6. Smoke-test a distinct localhost port (release used 3059), then stop the temporary service. Check real routes and inspect logs before activating.
7. Switch only the systemd `WorkingDirectory` through a purpose-named drop-in. `systemctl daemon-reload`, restart `traffic-web`, verify active directory, local pages, public homepage, public API health and all dependent services. If any post-switch check fails, immediately restore the previous override and restart the old service. Retain the old release until an explicit retirement review.

### Rollback to the preserved pre-release checkout

**Only if the old checkout and its build remain verified**, and no newer release superseded this receipt:

```bash
set -euo pipefail
OVERRIDE=/etc/systemd/system/traffic-web.service.d/50-verified-release.conf
STAGE=/mnt/HC_Volume_105319120/traffic-releases/web-6fc692d3c5581e2ca06e1a3567efbc084a047211
test "$(systemctl show --value -p WorkingDirectory traffic-web)" = "$STAGE"
test -f "$OVERRIDE"
test -s /var/www/Traffic/traffic-app/.next/BUILD_ID
rm -- "$OVERRIDE"
systemctl daemon-reload
systemctl restart traffic-web
test "$(systemctl show --value -p WorkingDirectory traffic-web)" = /var/www/Traffic/traffic-app
curl -fsS -m 15 http://127.0.0.1:3045/ -o /dev/null
systemctl is-active traffic-api traffic-web nginx
```

This is a **manual emergency rollback recipe**, not an instruction to execute during healthy operation. Preserve the staged release for a forward recovery and inspect systemd error output if health does not recover.

## Deferred and intentionally untouched

- Nginx JSON access logs currently do **not** log `cf_connecting_ip`. The API's trusted-Cloudflare header preference is forward-compatible but does not retroactively improve past IP attribution. Review Nginx provenance separately without casually modifying `real_ip_header`.
- No WoloChain, betting settlement, DNS, archive persistence or Nginx config changes were part of this frontend activation.
- Host root-disk pressure and legacy deployment credential/ownership consistency remain separate operational improvements.


## Browser-origin incident discovered after server-side smoke

On 2026-10-15, an actual external Chrome browser loaded the homepage shell but showed `Failed to fetch`. DevTools reported a fetch to `http://127.0.0.1:3345/api/overview?range_key=12h` failing with `ERR_CONNECTION_REFUSED`.

**Root cause:** `NEXT_PUBLIC_TRAFFIC_API_BASE_URL` in the web service environment was set to a VPS-only loopback origin. The production webpack build baked that environment value into browser JavaScript. A URL that works on the VPS is not usable by a remote browser: `127.0.0.1` on the client is the client's own computer.

Follow-up fix: `components/traffic/api.ts` now always emits same-origin `/api/*` paths for browser fetch and SSE, while server-side requests retain private API base URL resolution. Regression test `browser-api-origin.test.mts` simulates the hazardous environment and covers overview, live-stream, and project-stream URL construction.

**The earlier HTTP-200 smoke was necessary but insufficient:** it tested route HTML/server rendering, not client-side hydration and browser-origin API networking. Release verification must now include actual external-browser loading of the overview graph, live visitors, visits history, and a live-stream connection, plus the browser network panel showing same-origin `/api/*`. If those fail, do not label the release fully certified. A failed legacy public variable is not a reason to expose port 3345 publicly or alter API bind addresses.
