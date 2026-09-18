package pl.routecommunity.api.route;
import java.time.Instant;
import java.util.List;
public record RouteDto(String publicId, String name, String description, String originalFilename, double distanceMeters, Double elevationGainMeters, GeoJsonLineString geometry, Instant createdAt) {
    public record GeoJsonLineString(String type, List<List<Double>> coordinates) { }
}
