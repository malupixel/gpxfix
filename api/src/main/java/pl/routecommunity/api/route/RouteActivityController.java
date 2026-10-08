package pl.routecommunity.api.route;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/routes/{publicId}")
class RouteActivityController {
    private final RouteActivityService activity;
    private final RouteOwnershipService ownership;
    RouteActivityController(RouteActivityService activity,RouteOwnershipService ownership) { this.activity=activity;this.ownership=ownership; }
    @GetMapping("/activity") ResponseEntity<RouteActivityDto.Page> publicActivity(@PathVariable String publicId,
            @RequestParam(defaultValue="5") int limit,@RequestParam(required=false) String cursor) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(activity.list(publicId,false,limit,cursor));
    }
    @GetMapping("/owner/activity") ResponseEntity<RouteActivityDto.Page> ownerActivity(@PathVariable String publicId,
            @RequestParam(defaultValue="5") int limit,@RequestParam(required=false) String cursor,HttpServletRequest request) {
        ownership.requireOwner(publicId,request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(activity.list(publicId,true,limit,cursor));
    }
}
