# TweakMyRoute — Stage 2 UI

## Audit and scope

The route view uses `OwnershipGate`, `RouteHeader`, `RoutePageContent`, the existing MapLibre map, route editor, suggestion workflow and `ElevationChart`. The existing design system is Tailwind plus shared `route-card`/`route-button` classes. Stage 1 supplies activity, management dialogs and GPX export. Stage 2 reuses these foundations; it adds no UI library or database migration.

The old layout duplicated sharing/export, mixed suggestion tools with route modes, named every owner suggestion “moderation”, and displayed a permanent sharing promotion. These presentation issues have been removed. The map's immutable geometry reference, rendering/layers, snapping, anchors, distance markers, Squadrats, moderation transitions, merge rules and elevation calculations are retained.

## Structure and components

- `SiteHeader`: linked logo and language selector in normal document flow. The selector no longer overlays maps and dialogs.
- `RouteHeader`: route name, viewed-version/history button, quiet suggestion/owner indicators, distance/ascent and one primary action group: share, GPX, More. An explicit historical-version notice links back to the current route.
- `RouteShareDialog`: public links to the viewed version and latest route, with clipboard feedback/manual copying. Management tokens are obtained only through the existing separate private-link action.
- `RouteDownload`/`GpxExportDialog`: the same export mechanism from Stage 1, now launched in the header. Each history row can still open an export for that specific version.
- `RouteVersionNavigation`: existing version data and links presented in the shared accessible dialog.
- `RouteMapToolbar`: one mode selector using pressed-button semantics; suggestion actions remain inside the existing type picker/drawing workflow. The same selector indicates the active geometry editor mode; editor actions retain their meaning.
- `RouteFeedbackSidebar`: “Suggestions” for both public and owner views, independent status/type filters, pending-only attention count, compact cards and a bounded scrollable list accessible by keyboard. Actual suggestion details/actions live in `SuggestionDetail`.
- `ElevationProfile`: existing chart/highlight integration, labeled axes and loss/minimum/maximum summary. Ascent remains in the route header, avoiding duplication.
- `RouteInformation`: shared description (or real empty state) and secondary metadata, with owner information editing. Geometry metrics are not repeated here.
- `RouteActivityCard`: real events with decorative type icons, dates, existing links and paginated history.

## Responsive behavior

At 1280 px and above, the map/profile occupy the main column and suggestions sit alongside them; the information/activity sections follow in two columns with independent heights. Below that breakpoint the order is map, suggestions, profile, information/activity. Mobile map/panel shortcuts avoid scrolling back through the page; choosing a suggestion on the map brings its mobile detail panel into view.

The map keeps its original useful heights (minimum 360 px on phones, minimum 480 px on tablets, 570 px on desktop). Titles wrap even without spaces. On phones sharing/export occupy the first action row and More occupies the second. Menus/dialogs are bounded by viewport width and dynamic viewport height. Shared actions have 44 px touch targets and visible keyboard focus. Owner editor controls wrap into two rows on phones; Squadrats/navigation are positioned below them. Editor save forms can scroll when vertical space is limited.

Dialog focus trapping/restoration, Escape, backdrop dismissal and busy behavior reuse `RouteDialog`. Menu actions focus their persistent trigger before opening a management/history dialog.

## Branding and SEO

`web/public/logo.png` is an unchanged RGB PNG, 2172 × 724 pixels, aspect ratio 3:1, with an opaque light background. Next Image renders it at up to 330 px wide on desktop and 240 px on phones, with proportional height and `object-fit: contain`, inside a home link. The full image is displayed; it is not cropped or stretched.

Visible translation resources, route metadata and new GPX creator metadata use TweakMyRoute. Historical uploaded/stored GPX files and technical package/class/cookie/database names are unchanged. Public route titles/descriptions remain dynamic in PL/EN. Canonical links are explicitly public URLs under `https://tweakmyroute.com`; they never include management tokens. No structured-data component has been removed.

## Small compatible API extension

`GET /api/routes/{publicId}/suggestions?includeArchived=true` returns all **currently published** route suggestions, including merged and historical ones. It is required for the public Merged filter. The default remains the existing active suggestions for the requested version. The UI still sends only active suggestions for the viewed version to map overlays. Pending/rejected/unpublished suggestions and private comments remain excluded by backend authorization/publication rules. No statuses, endpoints or database tables were added.

## Verification

- Backend: full regression suite, 61 tests, zero failures/errors/skips. Archive assertions cover merged visibility and exclusion of pending, rejected and withdrawn suggestions while preserving the old default list.
- Frontend: 55 passing tests, including combined suggestion filters, public visibility and PL/EN completeness; lint and typecheck pass.
- Next.js production build with Node 24 and webpack passes in an isolated copy.
- Chrome/Playwright integration against a disposable PostGIS database: 375/768/1280/1920 px, logo proportions, no horizontal document overflow, long name, owner/public menus, real filters, publish/unpublish, historical GPX download, share/version links, version navigation, historical editing guard, editor/suggestion modes, fullscreen/profile, PL/EN, empty description/suggestions and retry after API failure. No page errors.
- Additional owner dialogs are checked with a 375 × 430 px viewport, keyboard focus trapping/restoration, metadata/settings/private link and confirmed deletion. Desktop fullscreen chart hover remains functional.

Screenshots and integration-run logs are under `/tmp/tmr-stage2-*`. Browser checks emulate viewport sizes in desktop Chrome; they do not certify native iOS/Android virtual-keyboard or Fullscreen API behavior. The existing mobile fullscreen fallback is preserved.

The working application's database and deployment are untouched. Deploy matching backend/frontend for the optional archive list parameter; no new migration is necessary.
