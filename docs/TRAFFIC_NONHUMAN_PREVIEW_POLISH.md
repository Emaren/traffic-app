# Human-first live Traffic visual polish (2026-10-15)

The existing observatory layout, sections, and default people-first feed remain unchanged.

## Changes

- Bot, script-burst and suspicious group summaries are rendered as one compact disclosure card showing *sessions grouped* and unique IP count.
- Disclosure expands to bounded representative IPs and paths (not a claim to contain full history).
- Synthetic groups do **not** link to made-up visitor profiles.
- A shared safety predicate refuses to group confirmed/likely/candidate humans, authenticated users or known human identities.
- Group data comes from the API's whole eligible nonhuman cohort **before** the eight-row preview limit. A small card replaces a swarm of unrelated individual cards.
- The main live EventSource is disconnected on tab hide and recreated when visible again. Poll fallback continues only while visible.
- Raw event-history, notification, project statistics, WoloChain and administrative visibility rules are not modified.

## Test and release

From repository root:

    npm ci
    npm test
    npm run lint
    npx tsc --noEmit
    npm run build

The pull request CI runs this same gate. Do not deploy on red checks or treat a green static build as production certification. Follow Traffic's existing deploy/restart, health check and rollback procedure; validate the real human feed, one grouped Ashburn-like crawler fleet, "Inspect samples", hidden-tab SSE reconnection, and 24-hour visitor history before marking done.

The related API change must deploy first: it emits burst_sample_ips and burst_paths and performs the grouping before preview limits. The web UI can render existing clusters, but the new large-scale fleet grouping is not effective until the API update is active.
