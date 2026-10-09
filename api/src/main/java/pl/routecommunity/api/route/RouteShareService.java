package pl.routecommunity.api.route;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.routecommunity.api.common.error.ApiException;

@Service
class RouteShareService {
    private final RouteRepository routes;
    private final RouteVersionRepository versions;
    private final RoutePreviewStore previews;
    private final RoutePreviewRenderer renderer;
    RouteShareService(RouteRepository routes, RouteVersionRepository versions, RoutePreviewStore previews, RoutePreviewRenderer renderer) {
        this.routes = routes; this.versions = versions; this.previews = previews; this.renderer = renderer;
    }
    @Transactional(readOnly = true)
    Share metadata(String publicId, Integer versionNumber) {
        Route route = active(publicId); RouteVersion version = version(route, versionNumber);
        String revision = RoutePreviewRenderer.revision(version.getId(), route.getName());
        String state = previews.exists(revision) ? "ready" : "fallback";
        return new Share(route.getPublicId(), route.getName(), route.getDescription(), version.getDistanceMeters(),
                version.getElevationGainMeters(), version.getVersionNumber(),
                "/api/routes/" + route.getPublicId() + "/versions/" + version.getVersionNumber() + "/preview/" + revision + ".png?state=" + state);
    }
    @Transactional(readOnly = true)
    Image image(String publicId, int versionNumber, String revision) {
        Route route = active(publicId); RouteVersion version = version(route, versionNumber);
        if (!RoutePreviewRenderer.revision(version.getId(), route.getName()).equals(revision)) throw missing();
        byte[] bytes = previews.read(revision);
        return new Image(bytes == null ? renderer.fallback() : bytes, bytes == null);
    }
    private Route active(String publicId) { return routes.findByPublicId(publicId).orElseThrow(RouteShareService::missing); }
    private RouteVersion version(Route route, Integer number) {
        return number == null ? route.getCurrentVersion() : versions.findByRoute_PublicIdAndVersionNumber(route.getPublicId(), number).orElseThrow(RouteShareService::missing);
    }
    private static ApiException missing() { return new ApiException(HttpStatus.NOT_FOUND, "Route preview not found"); }
    record Share(String publicId, String name, String description, double distanceMeters, Double elevationGainMeters, int versionNumber, String imagePath) { }
    record Image(byte[] bytes, boolean fallback) { }
}
