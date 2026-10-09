package pl.routecommunity.api.route;

import java.awt.geom.Point2D;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import pl.routecommunity.api.gpx.GpxTrack;

/** Project first, unwrap each segment at the antimeridian, then fit with one pixel scale. */
record RoutePreviewViewport(List<List<Point2D.Double>> segments) {
    static final double LEFT = 520, TOP = 130, WIDTH = 620, HEIGHT = 390, PADDING = 42;

    static RoutePreviewViewport fit(GpxTrack track) {
        var projected = new ArrayList<List<Point2D.Double>>();
        Double anchor = null;
        for (var segment : track.segments()) {
            if (segment.isEmpty()) continue;
            var points = new ArrayList<Point2D.Double>();
            double previousX = (segment.getFirst().longitude() + 180) / 360;
            for (var point : segment) {
                if (!Double.isFinite(point.latitude()) || !Double.isFinite(point.longitude())
                        || Math.abs(point.latitude()) > 90 || Math.abs(point.longitude()) > 180) {
                    throw new IllegalArgumentException("Invalid preview coordinate");
                }
                double x = (point.longitude() + 180) / 360;
                x += Math.rint(previousX - x); // preserve continuity across ±180° without a world-wide bridge
                points.add(new Point2D.Double(x, mercatorY(point.latitude())));
                previousX = x;
            }
            double center = (points.stream().mapToDouble(p -> p.x).min().orElseThrow()
                    + points.stream().mapToDouble(p -> p.x).max().orElseThrow()) / 2;
            if (anchor == null) anchor = center;
            double shift = Math.rint(anchor - center);
            for (var p : points) p.x += shift;
            projected.add(points);
        }
        var all = projected.stream().flatMap(List::stream).toList();
        if (all.size() < 2) throw new IllegalArgumentException("Preview needs two points");
        double minX = all.stream().mapToDouble(p -> p.x).min().orElseThrow();
        double maxX = all.stream().mapToDouble(p -> p.x).max().orElseThrow();
        double minY = all.stream().mapToDouble(p -> p.y).min().orElseThrow();
        double maxY = all.stream().mapToDouble(p -> p.y).max().orElseThrow();
        double scale = Math.min((WIDTH - 2 * PADDING) / Math.max(maxX - minX, 1e-12),
                (HEIGHT - 2 * PADDING) / Math.max(maxY - minY, 1e-12));
        double centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
        for (var segment : projected) for (var p : segment) {
            p.x = LEFT + WIDTH / 2 + (p.x - centerX) * scale;
            p.y = TOP + HEIGHT / 2 + (p.y - centerY) * scale;
        }
        return new RoutePreviewViewport(projected.stream().map(p -> simplify(p, 0.7)).toList());
    }

    static double mercatorY(double latitude) {
        double lat = Math.toRadians(Math.max(-85.05112878, Math.min(85.05112878, latitude)));
        return (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2;
    }

    /** Iterative Douglas–Peucker in output pixels: endpoints/closed loops survive, no recursion limit. */
    static List<Point2D.Double> simplify(List<Point2D.Double> points, double tolerance) {
        if (points.size() <= 2) return List.copyOf(points);
        boolean[] keep = new boolean[points.size()]; keep[0] = true; keep[points.size() - 1] = true;
        var stack = new ArrayDeque<int[]>(); stack.push(new int[]{0, points.size() - 1});
        while (!stack.isEmpty()) {
            var range = stack.pop(); var a = points.get(range[0]); var b = points.get(range[1]);
            double max = tolerance * tolerance; int furthest = -1;
            for (int i = range[0] + 1; i < range[1]; i++) {
                double distance = java.awt.geom.Line2D.ptSegDistSq(a.x, a.y, b.x, b.y, points.get(i).x, points.get(i).y);
                if (distance > max) { max = distance; furthest = i; }
            }
            if (furthest >= 0) {
                keep[furthest] = true;
                stack.push(new int[]{range[0], furthest}); stack.push(new int[]{furthest, range[1]});
            }
        }
        var result = new ArrayList<Point2D.Double>();
        for (int i = 0; i < points.size(); i++) if (keep[i]) result.add(points.get(i));
        return List.copyOf(result);
    }
}
