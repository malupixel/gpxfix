package pl.routecommunity.api.route;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
class RouteShareController {
    private final RouteShareService service;
    RouteShareController(RouteShareService service) { this.service = service; }
    @GetMapping("/api/routes/{publicId}/share")
    ResponseEntity<RouteShareService.Share> metadata(@PathVariable String publicId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.metadata(publicId, null));
    }
    @GetMapping("/api/routes/{publicId}/versions/{versionNumber}/share")
    ResponseEntity<RouteShareService.Share> versionMetadata(@PathVariable String publicId, @PathVariable int versionNumber) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.metadata(publicId, versionNumber));
    }
    @GetMapping(value = "/api/routes/{publicId}/versions/{versionNumber}/preview/{revision}.png", produces = MediaType.IMAGE_PNG_VALUE)
    ResponseEntity<byte[]> image(@PathVariable String publicId, @PathVariable int versionNumber, @PathVariable String revision) {
        var image = service.image(publicId, versionNumber, revision);
        // Revalidate on each request so deleted routes cannot be served from a browser/proxy cache.
        // Disk persistence means revalidation never re-renders the card. Fallback cannot poison that cache.
        return ResponseEntity.ok().cacheControl(image.fallback() ? CacheControl.noStore() : CacheControl.noCache())
                .header("X-Content-Type-Options", "nosniff").contentType(MediaType.IMAGE_PNG).body(image.bytes());
    }
}
