package pl.routecommunity.api.route;

import java.time.Instant;
import org.locationtech.jts.geom.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import pl.routecommunity.api.gpx.*;
import pl.routecommunity.api.storage.FileStorage;

/** The single persistence path for initial routes, owner edits and suggestion merges. */
@Service
class RouteVersionCreationService {
    private final RouteVersionRepository versions;
    private final RouteRepository routes;
    private final RouteVersionPipeline pipeline;
    private final FileStorage storage;
    private final GeometryFactory geometries = new GeometryFactory(new PrecisionModel(), 4326);

    RouteVersionCreationService(RouteVersionRepository versions, RouteRepository routes,
            RouteVersionPipeline pipeline, FileStorage storage) {
        this.versions = versions; this.routes = routes; this.pipeline = pipeline; this.storage = storage;
    }

    // Existing-route callers must hold the route lock for the whole transaction.
    @Transactional(propagation = Propagation.MANDATORY)
    Created create(Route route, RouteVersion base, RouteVersionSource origin, RouteSuggestion suggestion,
            String name, String description, String filename, GpxTrack source, byte[] originalGpx,
            String sourceType, String editorDefinition) {
        var prepared = pipeline.prepare(name, source, originalGpx);
        String key = storage.store(prepared.gpx());
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) storage.delete(key);
            }
        });
        LineString geometry = geometries.createLineString(source.points().stream()
                .map(p -> new Coordinate(p.longitude(), p.latitude())).toArray(Coordinate[]::new));
        RouteVersion version = versions.saveAndFlush(new RouteVersion(route, base == null ? 1 : base.getVersionNumber() + 1,
                Instant.now(), origin, base, suggestion, name, description, filename, key,
                source.distanceMeters(), prepared.track().elevationGainMeters(), geometry, sourceType, editorDefinition));
        route.publish(version);
        routes.saveAndFlush(route);
        return new Created(version, prepared.track());
    }

    record Created(RouteVersion version, GpxTrack track) { }
}
