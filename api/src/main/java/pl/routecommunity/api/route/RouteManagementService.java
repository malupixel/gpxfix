package pl.routecommunity.api.route;

import java.time.Instant;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.routecommunity.api.common.error.ApiException;

@Service
class RouteManagementService {
    private final RouteRepository routes;
    private final RouteActivityService activity;
    RouteManagementService(RouteRepository routes,RouteActivityService activity){this.routes=routes;this.activity=activity;}
    @Transactional void information(String publicId,RouteInformationRequest request) {
        Route route=locked(publicId);
        String name=RouteMetadataText.name(request.name()),description=RouteMetadataText.description(request.description());
        if(name.equals(route.getName())&&Objects.equals(description,route.getDescription()))return;
        if(!route.getUpdatedAt().equals(request.expectedUpdatedAt()))throw new ApiException(HttpStatus.CONFLICT,"Route information changed; reload before saving");
        Instant now=Instant.now();route.metadata(name,description,now);
        activity.record(route,RouteActivityType.METADATA_UPDATED,now,null,null,null,null,false,"metadata:"+now);
    }
    @Transactional void suggestions(String publicId,boolean enabled) {
        Route route=locked(publicId);if(route.isSuggestionsEnabled()==enabled)return;
        Instant now=Instant.now();route.suggestions(enabled,now);
        activity.record(route,enabled?RouteActivityType.SUGGESTIONS_OPENED:RouteActivityType.SUGGESTIONS_CLOSED,now,null,null,null,null,false,"settings:"+now);
    }
    @Transactional void delete(String publicId,String confirmationName) {
        Route route=locked(publicId);
        if(!route.getName().equals(confirmationName))throw new ApiException(HttpStatus.BAD_REQUEST,"Route name confirmation does not match");
        Instant now=Instant.now();route.delete(now);
        activity.record(route,RouteActivityType.ROUTE_DELETED,now,null,null,null,null,true,"deleted");
    }
    private Route locked(String publicId){return routes.findLockedByPublicId(publicId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Route not found"));}
}
