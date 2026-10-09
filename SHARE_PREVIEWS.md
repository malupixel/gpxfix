# Public route previews — local rendering

Next.js Metadata API still generates title, description, canonical, Open Graph and Twitter tags on the server. Metadata streaming remains disabled (`htmlLimitedBots: /.*/`) so bots receive tags in the initial HTML head. Public links describe the latest version; `/v/{number}` describes historical geometry. Names/descriptions remain shared across versions. The root favicon is unchanged.

## Local PNG renderer

Spring uses Java 21 Java2D/ImageIO to compose a 1200 × 630 PNG entirely locally: navy gradient, subtle grid, TweakMyRoute branding, route title on the left, a large green route on the right, START/FINISH, distance/ascent when available, and tweakmyroute.com. The fallback uses the same visual style with a decorative path. Text is rasterized directly, never interpolated into SVG/HTML, so markup characters are treated as literal text. Long titles wrap to four lines with an ellipsis, using Unicode code points. Fonts must support Polish characters (`fonts-dejavu-core` is suitable).

Coordinates come from `route_versions.track_geometry` in PostGIS via WKB. That existing LineString flattens GPX segments, so the worker reads the corresponding local GPX solely to recover segment boundaries. Enriched GPX may include extra elevation samples; the worker matches database vertices as an ordered subsequence of each segment. Unmatched vertices/endpoints fail into the existing retries/fallback rather than creating bridges. No elevation provider is called. GPX files therefore remain part of the persistent data required for previews, as before.

The renderer projects coordinates into Web Mercator, clamps polar latitudes to ±85.05112878°, unwraps consecutive longitudes across the antimeridian and aligns independent segments to the same world copy. Projected bounds fit the route panel with one uniform scale and 42 pixel padding. Short/long routes, loops, coincident endpoints and extreme aspect ratios stay centered without stretching. Douglas–Peucker simplification is iterative, operates separately per segment in output pixels, and preserves endpoints/corners/closed loops within 0.7 pixel error. Endpoint labels use opposing positions and split-color markers so START/FINISH remain legible on loops.

There are **no external network requests, tiles, paid services, API keys or subscriptions in OG rendering**. The generator has no HTTP client. Interactive map configuration and the application's unrelated routing/elevation providers are unchanged.

## Queue, persistence and access

The existing worker processes one committed version per run (default 5 seconds), prioritizing current versions and then backfilling history. PostgreSQL jobs survive restarts; atomic claims prevent duplicate work across API instances. Failures retry after approximately 1, 4 and 16 minutes, then keep the fallback after four attempts. Crawler requests only read files; they never render cards.

Files are written atomically under `${GPX_STORAGE_PATH}/previews` (override with `ROUTE_PREVIEW_STORAGE_PATH`), persisted by the existing Docker GPX volume. A SHA-256 revision includes `preview-local-v2`, version ID and shared route name. New versions/renames get new URLs; description-only changes update metadata without a render. The `state=fallback`/`state=ready` URL parameter also changes after generation, distinguishing the placeholder from the completed card.

Share metadata endpoints remain lightweight and independent of elevation enrichment. Image requests verify the active route and revision before reading a PNG. Fallback responses use `Cache-Control: no-store`; completed files use HTTP `no-cache` to revalidate route availability. Deleted routes, previous style URLs and obsolete name revisions return 404, including historical images. Keep the image directory outside Nginx's public root and preserve these headers in any reverse proxy/cache.

## Migration from the previous style

Deploy the API with Flyway migration **V10__regenerate_local_route_previews.sql**. It deletes only derived preview-job rows, including exhausted jobs, and leaves routes, version IDs, geometry, timestamps, GPX and activity untouched. The worker automatically regenerates every active version using `preview-local-v2` filenames/URLs, with the existing bounded background schedule. Pages temporarily advertise the local fallback until their images are ready. Public image access validates the new hash immediately, so no previous provider image is served even if its file remains on disk.

Old files are intentionally left in place to avoid destructive deployment cleanup; they are unreachable through the API and can be removed during normal storage maintenance after backing up and verifying regeneration. No old file is reused by the local renderer. Do not roll back only the JAR after this migration: rollbacks should include matching derived preview-job state, or clear preview jobs again so the chosen renderer can backfill them.

Freshly fetched HTML advertises new image URLs, invalidating browser/image caches. Social platforms can retain their previously downloaded page/card; our server cannot erase those remote copies. Refresh/rescrape existing public links with the platform's preview tooling when needed. A new image URL is used on the next crawl. Avoid caching route HTML in Nginx/CDN, or purge that cache during deployment.

## VPS deployment

- Deploy the API and let Flyway apply V10; restart its existing systemd service. No new npm/Maven dependencies, browser processes or services are needed.
- Remove the obsolete `STADIA_MAPS_API_KEY` from the API's systemd environment file. It is no longer read. Backend `SITE_URL` is no longer used by OG rendering. Keep frontend `SITE_URL=https://tweakmyroute.com` for canonical/absolute metadata URLs, independent of `API_INTERNAL_URL`.
- Ensure Java 21 has Polish-capable fonts (e.g. `fonts-dejavu-core`) and the service user can read local GPX and write the preview directory. Include the latter in systemd `ReadWritePaths` if filesystem restrictions are enabled. Java2D works headlessly.
- Existing `/api/` Nginx proxy/Next rewrites continue serving metadata and PNG. No public marker endpoints or outbound HTTPS permissions are needed for OG generation.
- Back up GPX, preview files and PostgreSQL. Retry exhausted local jobs after resolving an I/O/data/font problem with `UPDATE route_share_previews SET attempts=0, next_attempt_at=now() WHERE NOT ready;`.

## Verification

Automated tests render real local PNGs, without mocking a network provider. They cover dimensions, short/long/loop/extreme/degenerate routes, Mercator proportions, antimeridian crossing, independent segments without bridges, pixel-error simplification, Polish/English and literal markup text, missing/nonfinite statistics, fallback, atomic storage and style/version/name revisions. PostGIS tests cover real background rendering, fallback/retries after local errors, new versions/rename/deletion, and Flyway V9→V10 regeneration without modifying route versions. Existing frontend metadata tests and HTML behavior are unchanged.

For deployment smoke checks inspect the server HTML for OG/Twitter/canonical/favicon, fetch the advertised PNG, check route shape/text/endpoint labels, save a new version and verify the new URL, then delete the route and verify image/metadata 404. Sample PNGs can be exported from renderer tests using `-Dpreview.samples=/tmp/tmr-local-og-samples`.
