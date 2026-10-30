# Architecture — TrainLog

The system shape is a local-only installable web app ([ADR-001](./adr/ADR-001-system-shape.md)).
[diagram.html](./diagram.html) draws these tables.

## People

| ID | Name | Role |
|---|---|---|
| lifter | Lifter | Trains from structured programming, on a phone at the gym. Imports or authors routines, logs Sessions, reads progress, and exports backups. |

## Containers

| ID | Name | Responsibility | Technology | Zone | Boundary | State |
|---|---|---|---|---|---|---|
| spa | Single-page app | All screens and rules: import, scheduling, Session execution, progression, history, backup format | React, TypeScript, Vite | lifter's phone | inside | exists |
| service-worker | Service worker | Precaches the app shell, assets and fonts; serves deep links offline; detects updates | Workbox via vite-plugin-pwa | lifter's phone | inside | exists |
| local-store | Local store | The nine stores holding all training data and Settings ([ADR-004](./adr/ADR-004-indexeddb-via-dexie-as-the-only-store.md)) | IndexedDB through Dexie | lifter's phone | inside | exists |
| device-files | Device files and share sheet | Where routine files and backups come from, and where backups, CSV and routine files go | OS file picker, Web Share API | lifter's phone | outside | exists |
| static-host | Static host | Serves the built files with an SPA fallback. Receives no user data. | Cloudflare Workers static assets (`wrangler.jsonc`) | public internet | inside | exists |
| git-repo | Git repository | Source of the deploy: the `master` branch | GitHub | third party | outside | exists |

## Relations

| From | To | Purpose | Protocol | Kind |
|---|---|---|---|---|
| lifter | spa | Uses the installed app | Touch UI | local |
| spa | local-store | Reads and writes every record; a logged set is written immediately | IndexedDB transactions | local |
| spa | service-worker | Registers it and shows the update prompt | Service Worker API | local |
| spa | device-files | Opens routine files and backups; saves backups, CSV and routine files | File picker, Web Share | local |
| service-worker | static-host | Fetches the app files on install and on update, never user data | HTTPS | public |
| git-repo | static-host | Builds and deploys `master` | Cloudflare Git integration | deploy |

## Notes

- Nothing on the phone talks to the network except the service worker fetching the
  app's own files (NFR-002, AR-002).
- Inside `spa`, dependencies point `features → db → domain` and `features → pwa`. The
  rule lives in `quality-attributes.md` AR-001, and the components view of the diagram
  draws it.
- The deploy runs through Cloudflare's Git integration. There is no workflow file
  in the repository (`README.MD`).
