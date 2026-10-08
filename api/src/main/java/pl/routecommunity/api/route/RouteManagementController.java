package pl.routecommunity.api.route;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/routes/{publicId}/owner")
class RouteManagementController {
    private final RouteManagementService management;
    private final RouteService routes;
    private final RouteOwnershipService ownership;
    RouteManagementController(RouteManagementService management,RouteService routes,RouteOwnershipService ownership){this.management=management;this.routes=routes;this.ownership=ownership;}
    @PatchMapping("/information") ResponseEntity<RouteDto> information(@PathVariable String publicId,@Valid @RequestBody RouteInformationRequest body,HttpServletRequest request){
        ownership.requireOwner(publicId,request);management.information(publicId,body);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(routes.get(publicId,null));
    }
    public record SuggestionsRequest(@NotNull Boolean enabled) { }
    @PatchMapping("/suggestions-settings") ResponseEntity<RouteDto> suggestions(@PathVariable String publicId,@Valid @RequestBody SuggestionsRequest body,HttpServletRequest request){
        ownership.requireOwner(publicId,request);management.suggestions(publicId,body.enabled());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(routes.get(publicId,null));
    }
    public record DeleteRequest(@NotNull String confirmationName) { }
    @DeleteMapping ResponseEntity<Void> delete(@PathVariable String publicId,@Valid @RequestBody DeleteRequest body,HttpServletRequest request){
        ownership.requireOwner(publicId,request);management.delete(publicId,body.confirmationName());return ResponseEntity.noContent().build();
    }
}
