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
    private final RouteBranches branches;
    private final RouteVersionRepository versions;
    private final RouteRepository routes;
    private final RouteVersionPipeline pipeline;
    private final FileStorage storage;
    private final RouteActivityService activity;
    private final GeometryFactory geometries = new GeometryFactory(new PrecisionModel(), 4326);

    RouteVersionCreationService(RouteVersionRepository versions, RouteRepository routes,
            RouteVersionPipeline pipeline, FileStorage storage, RouteActivityService activity, RouteBranches branches) {this.branches=branches;
        this.versions = versions; this.routes = routes; this.pipeline = pipeline; this.storage = storage; this.activity=activity;
    }

    // Existing-route callers must hold the route lock for the whole transaction.
    @Transactional(propagation = Propagation.MANDATORY)
    Created create(Route route, RouteVersion base, RouteVersionSource origin, RouteSuggestion suggestion,
            String name, String description, String filename, GpxTrack source, byte[] originalGpx,
            String sourceType, String editorDefinition) {
        return create(route,base,origin,suggestion,name,description,filename,source,originalGpx,sourceType,editorDefinition,null);
    }
    @Transactional(propagation = Propagation.MANDATORY)
    Created create(Route route, RouteVersion base, RouteVersionSource origin, RouteSuggestion suggestion,
            String name,String description,String filename,GpxTrack source,byte[] originalGpx,String sourceType,String editorDefinition,RouteVersion exactFrom) {
        RouteBranch branch=base==null?branches.initial(route):branches.selected(route);
        var prepared = exactFrom!=null ? new RouteVersionPipeline.Prepared(source,originalGpx) : pipeline.prepare(name, source, originalGpx);
        String key = storage.store(prepared.gpx());
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) storage.delete(key);
            }
        });
        LineString geometry = geometries.createLineString(source.points().stream()
                .map(p -> new Coordinate(p.longitude(), p.latitude())).toArray(Coordinate[]::new));
        if(base==null) {
            route.metadata(name,description,route.getCreatedAt());
            if(originalGpx!=null && exactFrom==null) {
                String originalKey=java.util.Arrays.equals(originalGpx,prepared.gpx())?key:storage.store(originalGpx);
                if(!originalKey.equals(key)) TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override public void afterCompletion(int status){if(status!=STATUS_COMMITTED)storage.delete(originalKey);}
                });
                route.original(originalKey,filename);
            }
        }
        RouteVersion version = new RouteVersion(route, versions.nextNumber(route.getId()),
                Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS), origin, base, suggestion, name, description, filename, key,
                exactFrom==null?source.distanceMeters():exactFrom.getDistanceMeters(), exactFrom==null?prepared.track().elevationGainMeters():exactFrom.getElevationGainMeters(), exactFrom==null?geometry:exactFrom.getTrackGeometry(), sourceType, editorDefinition);
        version.branch(branch);
        versions.saveAndFlush(version);
        branches.publish(route,branch,version);
        routes.saveAndFlush(route);
        RouteActivityType type=switch(origin){
            case INITIAL_COPY,INITIAL_UPLOAD,INITIAL_DRAWN -> RouteActivityType.ROUTE_CREATED;
            case OWNER_EDIT -> RouteActivityType.OWNER_EDITED;
            case SUGGESTION_MERGE -> RouteActivityType.SUGGESTION_MERGED;
        };
        activity.record(route,type,version.getCreatedAt(),version,suggestion,null,null,false,"version:"+version.getId());
        return new Created(version, prepared.track());
    }

    record Created(RouteVersion version, GpxTrack track) { }
}
