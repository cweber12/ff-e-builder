# Privacy

FF&E Builder does not include third-party analytics.

## Local counters

The app stores a small local-only counter in `localStorage` under
`ffe-builder:telemetry`:

- `sessionCount`
- `itemsCreated`

This data never leaves the browser and is not sent to Firebase, Cloudflare,
Neon, or any analytics provider. It can be cleared by clearing site data in the
browser.

## Authentication

Firebase Auth handles identity. The frontend only receives public Firebase
configuration values and ID tokens required to call the Cloudflare Worker API.

## Data storage

Project, room, and item data is stored in Neon Postgres through the Cloudflare
Worker API. The React client must never connect directly to Neon.
