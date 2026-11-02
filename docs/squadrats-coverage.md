# Route square coverage

`SquadratsGrid` is shared by `RouteMap` and `EditorMap`. Each grid has its own
checkbox controlling both its lines and coverage fill. Squadrats are visible from
map zoom 10; Squadratinhos from 14. Counts always describe the entire current
polyline, including offscreen cells and regardless of checkbox state/zoom.
Historical pages pass their selected version's geometry; the editor passes
memoized `finalGeometry(document)`. Ghosts, suggestion geometry and drag previews
are not inputs. Committed edits, undo/redo and routing results update the input.

`route-tiles.ts` projects each coordinate once using the existing XYZ/Web Mercator
functions at tile zoom 17, reusing the projected vertices for zoom 14. DDA walks
only the cells encountered by each segment: O(points + grid crossings), with a
Set of unique canonical tile identifiers. It separately traverses the two levels
because a segment on an internal fine-grid boundary may still cross a parent's
interior. No polygon-vs-route global search or per-viewport coverage calculation
is performed. Polygons reuse `tileToBounds` from the line-grid implementation.

Only a positive-length passage through a cell's open interior counts. Paths
exactly on a cell edge count neither adjacent cell; corner-only contact and
zero-length segments do not count. The existing grid tolerance (1e-9 tile units)
handles projection roundoff at exact edges/corners. This is a geometric forecast,
not a claim about Squadrats' official collection rules or the user's history.
Segments are straight in Mercator as in the existing MapLibre GeoJSON renderer;
raw longitudes are preserved (no new shortest-path/antimeridian interpretation).

A debounced (120 ms) Web Worker computes both complete FeatureCollections. The
UI publishes only results matching the current immutable coordinate reference;
cleanup terminates superseded workers. Counts show an ellipsis while pending.
Coverage GeoJSON is sent to MapLibre when geometry changes, an overlay is
enabled, or the style is restored. Panning/resizing regenerates only viewport grid
lines. Fills sit below both grids and the route, at opacity 0.15 (green) / 0.20 (cyan).

To bound malformed/extreme inputs, more than 100,000 unique cells at either level
or 2,000,000 traversal steps aborts the calculation with a localized unavailable
message. Partial totals are never shown. Modern browser Web Worker support is
required. No backend, persistence, external API or new dependencies were added.

Regression coverage includes open interiors, sparse segments, repeats, edges,
corners, fine-edge/parent behavior, Mercator latitudes, world copies, independent
rectangle-clipping comparisons, allocation limits, independent toggles, both
fills, offscreen counts, ghosts/suggestions, drawing, editing/drag/undo/redo,
saving and historical versions, style reload, fullscreen, PL/EN and a roughly
500 km GPX with 20,001 points. The long-route fixture yields 333 Squadrats and
2,659 Squadratinhos; browser instrumentation verifies no new coverage job on pan.
