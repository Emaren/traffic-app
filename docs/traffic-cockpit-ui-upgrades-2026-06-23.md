# Traffic Cockpit UI Upgrades — 2026-06-23

Current web head: `29ed5e2`

## Cockpit graph

The Traffic graph now renders multiple operator lines:

- Confirmed humans
- Potential / audience signal
- Page interest
- First touches
- Unique IPs
- Requests

Line colors can be customized from the UI and persist locally.

## Stream cards

Live visitor cards now expose browser engagement directly on collapsed cards:

- scrolled percent
- clicks
- browser signal count

Expanded cards show an explicit "No browser telemetry" state when the browser beacon did not produce engagement rows.

## Spike Read

The graph now includes a Spike Read analyst card.

It explains:

- request peak
- audience peak
- first-touch peak values
- page-interest peak values
- audience signals
- request-per-IP pressure
- raw source diagnosis when available

## Notifications

The admin Delivery lane supports native Traffic web push. Mobile admin scrolling was repaired so the provider/policy/web-push cards can be reached on iPhone.

## Mobile scroll repairs

Mobile nested scroll traps were removed or desktop-scoped across:

- notification admin
- Delivery lane
- Who did what / visitor stories
- live visitor stream
- project live feed
- visitor session cards

Mobile should now page-scroll naturally instead of clipping tall tiles inside viewport-locked cards.
