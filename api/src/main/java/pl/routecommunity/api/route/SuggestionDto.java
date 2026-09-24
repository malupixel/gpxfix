package pl.routecommunity.api.route;

import java.time.Instant;
import java.util.List;

public record SuggestionDto(String publicId,SuggestionType type,SuggestionStatus status,String authorName,String description,
        String category,List<String> tags,Anchor start,Anchor end,GeoJsonLineString proposedGeometry,
        Instant baseRouteUpdatedAt,Instant createdAt,Instant updatedAt) {
    public record Anchor(double longitude,double latitude,double distanceMeters) { }
    public record GeoJsonLineString(String type,List<List<Double>> coordinates) { }
}
