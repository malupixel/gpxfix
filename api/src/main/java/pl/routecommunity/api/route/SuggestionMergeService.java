package pl.routecommunity.api.route;

import java.time.Instant;
import java.util.*;
import org.locationtech.jts.geom.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.routecommunity.api.common.error.ApiException;
import pl.routecommunity.api.gpx.*;
import pl.routecommunity.api.storage.FileStorage;

@Service
class SuggestionMergeService {
    private final RouteRepository routes;private final RouteVersionRepository versions;private final RouteSuggestionRepository suggestions;private final List<SuggestionMergeHandler> handlers;private final RouteVersionPipeline pipeline;private final FileStorage storage;private final RouteMapper mapper;
    SuggestionMergeService(RouteRepository routes,RouteVersionRepository versions,RouteSuggestionRepository suggestions,List<SuggestionMergeHandler> handlers,RouteVersionPipeline pipeline,FileStorage storage,RouteMapper mapper){this.routes=routes;this.versions=versions;this.suggestions=suggestions;this.handlers=handlers;this.pipeline=pipeline;this.storage=storage;this.mapper=mapper;}
    @Transactional
    RouteDto merge(String routePublicId,String suggestionPublicId){
        Route route=routes.findLockedByPublicId(routePublicId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Route not found"));
        RouteSuggestion suggestion=suggestions.findByRoute_PublicIdAndPublicId(routePublicId,suggestionPublicId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Suggestion not found"));
        SuggestionMergeHandler handler=handlers.stream().filter(value->value.supports(suggestion.getType())).findFirst().orElseThrow(()->new ApiException(HttpStatus.CONFLICT,"This suggestion type does not create an official route version"));
        if(suggestion.getModerationStatus()!=ModerationStatus.PUBLISHED||suggestion.getIntegrationStatus()!=SuggestionIntegrationStatus.NOT_MERGED)throw new ApiException(HttpStatus.CONFLICT,"Only a published, unmerged suggestion can be merged");
        LineString geometry=handler.apply(suggestion,route.getCurrentVersion());
        RouteVersion current=route.getCurrentVersion();List<GpxPoint> points=Arrays.stream(geometry.getCoordinates()).map(c->new GpxPoint(c.y,c.x,null)).toList();GpxTrack source=GpxParser.calculateMetrics(List.of(points));RouteVersionPipeline.Prepared prepared=pipeline.prepare(current.getName(),source,null);String storageKey=storage.store(prepared.gpx());
        try{GpxTrack track=prepared.track();Instant now=Instant.now();RouteVersion next=versions.saveAndFlush(new RouteVersion(route,current.getVersionNumber()+1,now,RouteVersionSource.SUGGESTION_MERGE,current,suggestion,current.getName(),current.getDescription(),current.getOriginalFilename(),storageKey,source.distanceMeters(),track.elevationGainMeters(),geometry,"GPX",null));suggestion.mergeInto(next,now);route.publish(next);suggestions.save(suggestion);routes.saveAndFlush(route);return mapper.toDto(route,next,track);}catch(RuntimeException failure){storage.delete(storageKey);throw failure;}
    }
}
