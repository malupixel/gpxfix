package pl.routecommunity.api.route;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import pl.routecommunity.api.gpx.GpxParser;
import pl.routecommunity.api.gpx.GpxTrack;
import pl.routecommunity.api.gpx.GpxPoint;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.io.WKBReader;
import java.util.ArrayList;
import java.util.List;
import pl.routecommunity.api.storage.FileStorage;

/** Small durable queue inferred from committed versions; also backfills existing routes. */
@Component
@EnableScheduling
class RoutePreviewWorker {
    private static final Logger log = LoggerFactory.getLogger(RoutePreviewWorker.class);
    private final JdbcTemplate jdbc;
    private final RoutePreviewRenderer renderer;
    private final RoutePreviewStore previews;
    private final FileStorage gpx;
    private final GpxParser parser;
    RoutePreviewWorker(JdbcTemplate jdbc, RoutePreviewRenderer renderer, RoutePreviewStore previews, FileStorage gpx, GpxParser parser) {
        this.jdbc = jdbc; this.renderer = renderer; this.previews = previews; this.gpx = gpx; this.parser = parser;
    }
    @Scheduled(fixedDelayString = "${app.preview.poll-delay-ms:5000}", initialDelayString = "${app.preview.poll-delay-ms:5000}")
    void generateNext() {
        var jobs = jdbc.query("""
                SELECT v.id, r.name, v.storage_key, ST_AsBinary(v.track_geometry) AS geometry, v.distance_meters, v.elevation_gain_meters
                FROM route_versions v JOIN routes r ON r.id=v.route_id
                LEFT JOIN route_share_previews p ON p.version_id=v.id AND p.name=r.name
                WHERE r.deleted_at IS NULL AND (p.version_id IS NULL OR
                    (NOT p.ready AND p.attempts < 4 AND p.next_attempt_at <= now()))
                ORDER BY (r.current_version_id=v.id) DESC, v.created_at DESC LIMIT 1
                """, (rs, row) -> new Job(rs.getLong("id"), rs.getString("name"), rs.getString("storage_key"), rs.getBytes("geometry"),
                        rs.getDouble("distance_meters"), rs.getObject("elevation_gain_meters", Double.class)));
        if (jobs.isEmpty()) return;
        var job = jobs.getFirst(); String revision = RoutePreviewRenderer.revision(job.id(), job.name());
        // Atomic claim with a lease survives process restarts and prevents two API instances rendering the same job.
        var claimed = jdbc.queryForList("""
                INSERT INTO route_share_previews(version_id,name,revision,attempts,next_attempt_at)
                VALUES (?,?,?,1,now()+interval '1 minute')
                ON CONFLICT(version_id,name) DO UPDATE SET attempts=route_share_previews.attempts+1,
                    next_attempt_at=now() + interval '1 minute' * power(4,route_share_previews.attempts)
                WHERE NOT route_share_previews.ready AND route_share_previews.attempts < 4
                    AND route_share_previews.next_attempt_at <= now()
                RETURNING attempts
                """, job.id(), job.name(), revision);
        if (claimed.isEmpty()) return;
        try {
            // Reuse a completed atomic write after a process crash.
            if (previews.read(revision) == null) {
                var boundaries = parser.parse(gpx.load(job.storageKey()));
                var geometry = databaseTrack(new WKBReader().read(job.geometry()).getCoordinates(), boundaries);
                byte[] png = renderer.render(job.name(), geometry, job.distance(), job.elevation());
                // A deletion or rename during rendering must never publish stale metadata.
                Boolean active = jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM routes r JOIN route_versions v ON v.route_id=r.id WHERE v.id=? AND r.deleted_at IS NULL AND r.name=?)", Boolean.class, job.id(), job.name());
                if (!Boolean.TRUE.equals(active)) return;
                previews.write(revision, png);
            }
            jdbc.update("UPDATE route_share_previews SET ready=true WHERE revision=?", revision);
        } catch (Exception failure) {
            // Log identifiers and exception types, without user text or storage paths.
            if (failure instanceof InterruptedException) Thread.currentThread().interrupt();
            log.warn("Route preview generation failed for version {} (attempt {}): {}", job.id(), claimed.getFirst().get("attempts"), failure.getClass().getSimpleName());
        }
    }
    /** PostGIS supplies vertices; stored GPX only supplies segment boundaries absent from the LineString model. */
    static GpxTrack databaseTrack(Coordinate[] coordinates, GpxTrack boundaries) {
        var segments = new ArrayList<List<GpxPoint>>();int offset = 0;
        // Enriched GPX retains all original vertices but can insert elevation samples between them.
        // Match the original database vertices as an ordered subsequence, separately per segment.
        for (var boundary : boundaries.segments()) {
            if (boundary.isEmpty()) continue;
            var segment = new ArrayList<GpxPoint>();
            for (var point : boundary) {
                if (offset < coordinates.length && matches(coordinates[offset], point)) {
                    var coordinate = coordinates[offset++];segment.add(new GpxPoint(coordinate.y, coordinate.x, null));
                }
            }
            if (segment.isEmpty() || !matches(new Coordinate(segment.getFirst().longitude(), segment.getFirst().latitude()), boundary.getFirst())
                    || !matches(new Coordinate(segment.getLast().longitude(), segment.getLast().latitude()), boundary.getLast())) {
                throw new IllegalArgumentException("Inconsistent preview segment boundaries");
            }
            segments.add(List.copyOf(segment));
        }
        if (offset != coordinates.length) throw new IllegalArgumentException("Inconsistent preview geometry");
        return new GpxTrack(List.copyOf(segments), boundaries.distanceMeters(), null);
    }
    private static boolean matches(Coordinate coordinate, GpxPoint point) {
        return Math.abs(coordinate.x-point.longitude()) <= 1e-7 && Math.abs(coordinate.y-point.latitude()) <= 1e-7;
    }
    private record Job(long id, String name, String storageKey, byte[] geometry, double distance, Double elevation) { }
}
