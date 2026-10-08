package pl.routecommunity.api.route;

import java.time.Instant;
import java.util.*;
import org.locationtech.jts.geom.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.routecommunity.api.common.error.ApiException;
import pl.routecommunity.api.gpx.*;

@Service
class SuggestionMergeService {
    private final RouteRepository routes;
    private final RouteSuggestionRepository suggestions;
    private final List<SuggestionMergeHandler> handlers;
    private final RouteVersionCreationService creation;
    private final RouteMapper mapper;
    SuggestionMergeService(RouteRepository routes,RouteSuggestionRepository suggestions,List<SuggestionMergeHandler> handlers,RouteVersionCreationService creation,RouteMapper mapper){this.routes=routes;this.suggestions=suggestions;this.handlers=handlers;this.creation=creation;this.mapper=mapper;}
    @Transactional
    RouteDto merge(String routePublicId,String suggestionPublicId){
        Route route=routes.findLockedByPublicId(routePublicId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Route not found"));
        RouteSuggestion suggestion=suggestions.findByRoute_PublicIdAndPublicId(routePublicId,suggestionPublicId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Suggestion not found"));
        SuggestionMergeHandler handler=handlers.stream().filter(value->value.supports(suggestion.getType())).findFirst().orElseThrow(()->new ApiException(HttpStatus.CONFLICT,"This suggestion type does not create an official route version"));
        if(suggestion.getModerationStatus()!=ModerationStatus.PUBLISHED||suggestion.getIntegrationStatus()!=SuggestionIntegrationStatus.NOT_MERGED)throw new ApiException(HttpStatus.CONFLICT,"Only a published, unmerged suggestion can be merged");
        LineString geometry=handler.apply(suggestion,route.getCurrentVersion());
        RouteVersion current=route.getCurrentVersion();
        List<GpxPoint> points=Arrays.stream(geometry.getCoordinates()).map(c->new GpxPoint(c.y,c.x,null)).toList();
        GpxTrack source=GpxParser.calculateMetrics(List.of(points));
        var created=creation.create(route,current,RouteVersionSource.SUGGESTION_MERGE,suggestion,current.getName(),current.getDescription(),current.getOriginalFilename(),source,null,"GPX",null);
        suggestion.mergeInto(created.version(),Instant.now());
        suggestions.saveAndFlush(suggestion);
        return mapper.toDto(route,created.version(),created.track());
    }
}
