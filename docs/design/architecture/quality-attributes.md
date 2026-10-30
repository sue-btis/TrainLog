# Quality Attributes — TrainLog

## NFR responses

| NFR | Design response | Evidence |
|---|---|---|
| NFR-001 | The service worker precaches the app shell, assets and fonts, and serves deep links from `index.html`. The catalog ships in the bundle. No feature fetches at runtime (ADR-001). | On-device check: J-001 to J-005 in airplane mode after first load. `src/pwa/config.ts` |
| NFR-002 | There is no endpoint in the system. Data leaves only through a file the lifter saves (ADR-001). | Architecture rule AR-002. The only outbound traffic is the service worker's fetches of its own assets. |
| NFR-003 | Every set is written to IndexedDB in its own transaction before the UI confirms it (ADR-004). Session state never lives only in memory. | `src/db/repositories/sessions.test.ts`; on-device kill test |
| NFR-004 | Remaining rest is computed from the persisted set timestamp against the wall clock. The interval only repaints. | `src/domain/session/index.test.ts` (`restRemaining`). On-device lock test for two minutes. Pause and added time are not persisted (brief DR-008). |
| NFR-005 | At most one Session is `in_progress`, and Today finds it on open and offers to resume it. | `src/db/repositories/sessions.test.ts`; on-device check |
| NFR-006 | Indexed lookups by owner id are used, and history is aggregated in pure functions in memory. The progress screen is lazy-loaded. | Not measured. Measuring it on a mid-range phone is still to be done. |
| NFR-007 | Layouts are mobile-first, and DESIGN.md governs them. | Manual check at 360 and 430 px |
| NFR-008 | The envelope uses PBKDF2-SHA-256 with 600,000 iterations and AES-GCM-256, with a random salt and IV. The iteration bounds are validated on read (ADR-005). | `src/domain/backup/encryption.test.ts` |
| NFR-009 | Each backup carries its `version`. The schema fills defaults for fields older versions lack, and newer versions are refused (ADR-005). | `src/domain/backup/schema.test.ts`, `schema.fuzz.test.ts`, `src/db/repositories/backup.test.ts` |
| NFR-010 | A fixed header is defined in one module, and new columns are appended to it. | `src/domain/backup/csv.test.ts` |
| NFR-011 | The parser accepts `version` 1 and 2, and the documented examples are executed as tests. | `src/domain/routine-file/*.test.ts`, `format-doc.test.ts`, the fixtures in `docs/examples/` |

## Tradeoffs

| Decision | Improves | Worsens | Accepted because |
|---|---|---|---|
| ADR-001 local-only | Privacy, cost, offline | Durability (browser eviction), multi-device | CON-001, CON-002; mitigated by FR-084, FR-088, FR-089 |
| ADR-003 snapshot | History truth, safe additions | Data duplication, migration on snapshot change | BR-001, BR-002 |
| ADR-004 IndexedDB without relational integrity | Native, transactional, testable | Referential rules live in code | Covered by repository tests |
| ADR-005 password encryption | Confidentiality off-device | A forgotten password is unrecoverable | It is optional; a plain backup remains available |
| Rest timer state in the component | Simplicity | Pause and added time lost on reload | Countdown correctness (NFR-004) still holds |

## Threats

| Boundary crossing | Threat (STRIDE) | Mitigation or accepted risk |
|---|---|---|
| Routine file into the app | Tampering / DoS: a crafted YAML | Structural schema validation before the wizard (FR-002) and semantic checks before Accept (FR-003). Nothing is stored before Accept. |
| Backup file into the app | Tampering / DoS: a crafted JSON or envelope | Whole-file validation and cross-referencing before any write (FR-077). AES-GCM authentication. Iteration count bounded (ADR-005). A safety backup is taken first (FR-078). |
| Backup or CSV out to third-party storage | Information disclosure | Optional encryption (NFR-008). Plain files are the lifter's accepted choice. |
| CSV into a spreadsheet | Tampering: formula injection | Cells that start with a formula character are prefixed with `'` (`src/domain/backup/csv.ts`). |
| Static host to device | Tampering with app files | HTTPS from the host. The service worker updates only on the lifter's Reload (FR-090). |
| Browser storage | Denial: eviction or the user clearing site data | Persistent storage is requested (FR-089), a warning is shown (FR-088), and a backup reminder appears (FR-084). The residual risk is accepted under ADR-001. |

## Capacity and cost

| Quantity | Estimate | Measured or assumed | Source |
|---|---|---|---|
| Sets logged | ~128 per week, ~6,700 per year | Assumed: 4 Sessions × 8 exercises × 4 sets | PRD usage context |
| Stored history growth | ~2 MB per year | Assumed: ~300 B per set row, plus Session overhead | — |
| Runtime requests per Session | 0 | Measured: a grep of `src/` found no network APIs | Brief CON-001 |
| Hosting cost | Within the static-assets free tier | Assumed, not verified against current pricing | `wrangler.jsonc` |

## Operations

| Failure | How it is detected | Recovery |
|---|---|---|
| The app is killed mid-session | Today shows the open Session | Resume. Logged sets are already stored. |
| Browser storage is evicted or cleared | Data is absent on open | Restore the latest backup (J-005) |
| A restore of a bad or newer file | Validation refuses it before any write | Nothing changed. Update the app or pick another file. |
| A restore of the wrong file | The lifter notices after the restore | Restore the safety backup saved just before (FR-078) |
| A new version is deployed | The update prompt is shown | The lifter taps Reload. The database schema upgrades forward (ADR-004). |
| A deploy | Cloudflare Git integration on `master` | Redeploy the previous commit. Data is unaffected because it lives on devices. |

## Architecture rules

| Rule | Source | Check |
|---|---|---|
| AR-001 Dependencies point `features → db → domain` and `features → pwa`. `domain/` imports neither `db/` nor `features/`, and touches no storage or UI. `pwa/` imports neither `features/`, `db/` nor `domain/`. | `architecture.md` Notes; the components view of `diagram.html` | `no-restricted-imports` in `eslint.config.js` covers `domain/` and `db/`. The `pwa/` rule is checked by review only. |
| AR-002 No runtime network calls (`fetch`, XHR, WebSocket, beacon) in `src/` | ADR-001, NFR-002 | A grep check, which could become a lint rule |
| AR-003 Only `src/db/` touches IndexedDB | ADR-004 | Review. No lint rule stops `features/` from importing `dexie`; only `domain/` is restricted. |
| AR-004 Measurement facts are stated only in `src/domain/measurement.ts` | Domain cross-boundary rules | Review |
| AR-005 History reads the Exercise Session snapshot, never the Planned Exercise | ADR-003 | `src/domain/history.test.ts`, review |
| AR-006 Each schema version change has a forward upgrade and bumps `BACKUP_VERSION` when the stored shape changes | ADR-004, ADR-005 | `src/db/schema.test.ts`, `src/domain/backup/schema.test.ts` |
