# Route management — Stage 1

## Audit and reuse

The application already had immutable `route_versions`, owner session cookies derived from management tokens, moderation statuses, suggestion/comment relationships, a transactional version creation service, a GPX parser/writer and a filesystem storage abstraction. These remain the foundations for Stage 1. There was no activity ledger, suggestion intake setting or deletion state.

Map geometry, snapping, drawing, suggestion geometry, moderation transitions, merge handlers, profile calculations and Squadrats remain unchanged. The route page retains an immutable version's geometry reference during metadata refreshes, so changing information/settings does not recreate MapLibre. Details reuse `elevationSummary` and `areRouteEndpointsClose`, including their existing noise and endpoint thresholds.

## Migration V8

`V8__route_management_and_activity.sql` adds shared route metadata, `suggestions_enabled`, `deleted_at`, optional original-upload storage references, and `route_activity` with foreign keys, pagination indexes and uniqueness constraints.

The current version supplies each existing route's initial shared name/description/update timestamp. Historical version rows and files remain intact. Activity backfills only recorded version creation, suggestion creation and comment creation timestamps. It does not invent past publication, rejection or metadata-change events. `ON CONFLICT` makes the backfill inserts idempotent.

## Metadata and deletion

Names/descriptions belong to the route and apply to all viewed versions. Editing only this information creates an activity event, not a geometry version. Names are limited to 200 characters, optional descriptions to 10,000, and invalid XML characters are rejected so subsequent GPX remains valid. Existing legacy descriptions are retained by the migration. Content remains plain text and is escaped by React/XML serialization.

Information updates require `expectedUpdatedAt` to prevent lost changes. New geometry-edit clients also send this timestamp alongside the existing base-version guard. The optional timestamp keeps older geometry-edit requests valid.

Deletion requires the exact route name and an authorized owner session. It sets `deleted_at`; all route-scoped public and owner reads/mutations then return 404. Versions, suggestions, comments, sessions, original files and activity are retained. Physical purge, retention policy and restore actions are outside Stage 1.

## Activity and retries

Business services synchronously insert events in their own database transaction. Version creation, owner edits and merges use the existing single creation path. Failed or rolled-back operations cannot leave committed activity behind.

Activity responses contain a public event UUID, type, occurrence timestamp, related version number and public suggestion/comment IDs, actor role/name and structured metadata. They contain no management tokens, database row IDs, request keys/hashes or interface sentences.

Public queries filter before pagination, checking the **current** publication state of both the suggestion and the comment. Unpublished/rejected subjects disappear from the public ledger, including previously visible creation/publication events. Unpublish/rejection events are owner-only. Owner reads require the existing route-scoped session cookie. Queries use scalar SQL joins, not one entity fetch per event. Activity responses use `Cache-Control: no-store`.

Pages sort by `(occurred_at DESC, id DESC)`. A cursor includes that public UUID and timestamp; a limit of 1–100 is accepted (default 5). The next page is fetched only when requested.

Suggestion/comment creation accepts optional `Idempotency-Key` headers (1–120 ASCII letters, digits, `_` or `-`). The clients reuse a random key for retries of the same payload and replace it if the payload changes. The route lock serializes retries; a private command fingerprint stored with the activity record detects key reuse with different data (409). Replays return the original subject without another event. Requests without a key remain compatible and represent independent submissions. Repeated nonterminal moderation/settings/metadata saves do not create duplicate events. A repeated merge retains its existing 409 terminal-state behavior and creates no version/event.

## GPX and originals

The existing latest and historical download URLs remain available. Optional `elevation` (default `true`) and `filename` query parameters select variants. Downloads transform **persisted bytes of the selected version**, never call an elevation provider, retain track segmentation and metadata attribution, and omit `<ele>` completely when disabled. The exported name/description use shared route metadata. Safe ASCII filenames include a version suffix by default, even for long names. Exports are returned as HTTP responses without storing additional variants or introducing a cache.

`X-Elevation-Available` indicates whether the stored version contains elevations. Legacy views may enrich a missing profile in memory using their existing behavior; an export still includes only heights actually persisted with that version. The UI explains omitted/missing elevations.

New uploads preserve the exact original using `FileStorage`, reusing the version's key when its bytes are identical and storing original bytes separately only if enrichment changed them. Rollbacks clean up both newly stored files. Drawn routes have no original. Older uploads cannot reliably be identified as untouched originals, so their original action is unavailable. No legacy bytes are guessed or mislabeled.

## API

All paths below start with `/api/routes/{publicId}`. Owner operations use the existing `route_owner` session cookie, established by the secret management link.

| Method | Path | Behavior |
|---|---|---|
| GET | `/activity?limit=5&cursor=…` | Public activity page `{ items, nextCursor }` |
| GET | `/owner/activity?limit=5&cursor=…` | Authorized full activity page |
| PATCH | `/owner/information` | `{ name, description, expectedUpdatedAt }`; returns current route DTO |
| PATCH | `/owner/suggestions-settings` | `{ enabled }`; returns current route DTO |
| DELETE | `/owner` | `{ confirmationName }`; soft deletion, 204 |
| GET | `/gpx?elevation=true&filename=…` | Existing latest-version GPX URL with optional export parameters |
| GET | `/versions/{number}/gpx?elevation=true&filename=…` | Existing version-specific GPX URL with optional parameters |
| GET | `/gpx/original` | Exact original upload when known; otherwise 404 |

Route DTOs add `updatedAt`, `versionCreatedAt`, `versionCount`, `creationSource`, `suggestionsEnabled` and `originalAvailable`. `createdAt` now consistently refers to route creation; the viewed version's timestamp is `versionCreatedAt`. Legacy `originalFilename` remains a string; the UI displays it as an uploaded filename only for `INITIAL_UPLOAD` routes. Version-dependent geometry/profile/distance still describe the viewed version. All version numbers remain contiguous and retained, so the latest immutable version number also gives the version count.

## Frontend

`RouteActivityCard` provides recent activity and a paginated history dialog. Links open the related version/suggestion/comment, including published merged suggestions that are no longer active map overlays. `RouteDownload` and `GpxExportDialog` share version-specific export controls with history rows. `RouteMoreMenu` reuses existing version history, private-link retrieval and the details section. Separate dialogs handle information, suggestion intake and confirmed deletion. New labels, states, errors and success notices use PL/EN resources.

## Validation and deployment

Backend integration tests cover real events, rollback after an event was written, failed/repeated merges, publication withdrawal, comment privacy, cursor pages, idempotent retries, owner authorization, shared metadata, unchanged version rows, original bytes, version geometry, filenames/elevation variants, stale editor protection and soft deletion. Frontend tests cover translation completeness, API/version/export links and existing route/editor/profile behavior. An isolated Playwright run exercises owner/public menus, real paginated activity, metadata rendering, PL/EN, actual downloads, settings and confirmed deletion against a disposable database.

Apply V8 with the updated backend, then use the matching frontend. Do not keep old backend writers running after V8: shared route metadata columns are required for newly created routes. The change deliberately makes archived routes show current shared metadata, and legacy downloads omit heights that were never persisted. Public GPX URL paths remain compatible. No deployment or migration of the working application's database is performed merely by running the isolated tests.
