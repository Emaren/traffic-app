# traffic-app

Next.js reporting and operator UI for Traffic.

## What this app owns

- homepage observatory surfaces
- project detail pages
- visitor profile pages
- visits archive
- admin notification cockpit
- PWA shell and native web-push enrollment UI

## Core routes

- `/` - observatory homepage
- `/visits` - historical session archive
- `/projects/[slug]` - per-project reporting
- `/visitors/[visitorId]` - visitor profile and live activity
- `/admin` - notification cockpit and device enrollment

## Admin notification truths

- `selected_projects = []` means wide-open mode, not "nothing selected"
- the admin UI should render wide-open mode as every project included
- `Save delivery settings` stores policy/provider changes
- `Enable on this device` registers the current PWA/browser as a push target
- operator identities can be removed in the UI, but the quick `Mark as me` delivery-log action has been removed
- `Suppress operator/self traffic` is a policy toggle, not an identity toggle
- `Only notify for real page hits` can still suppress `/api/...` traffic even when operator suppression is off

## PWA notes

- the main app manifest starts at `/`
- `/admin` has its own manifest so it can be installed separately as `Traffic Admin`
- native Traffic web push is the preferred phone-notification path
- Pushover remains a backup transport, not the preferred direct-open experience

## Development

```bash
npm install
npm run dev
```

Default local dev server:

- [http://localhost:3000](http://localhost:3000)

## Build and verify

```bash
npm run lint
npm run build
```

## Production assumptions

- app commonly runs behind nginx
- production web commonly binds to `127.0.0.1:3045`
- the app expects the Traffic API to be reachable through the configured API base/proxy paths

## Mobile rule

Keep the observatory and admin surfaces mobile-friendly:

- no horizontal scrolling
- stack controls before forcing multi-column layouts
- let long tokens wrap safely
- ensure clickable controls keep obvious pointer/press affordances
