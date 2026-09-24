package pl.routecommunity.api.route;

import java.time.Instant;
import java.util.List;

public record SuggestionDto(String publicId,SuggestionType type,ModerationStatus moderationStatus,SuggestionIntegrationStatus integrationStatus,SuggestionApplicability applicability,String authorName,String description,
        String category,List<String> tags,Anchor start,Anchor end,GeoJsonLineString proposedGeometry,
        Instant baseRouteUpdatedAt,Instant createdAt,Instant updatedAt,long commentCount,List<SuggestionCommentDto> comments) {
    public record Anchor(double longitude,double latitude,double distanceMeters) { }
    public record GeoJsonLineString(String type,List<List<Double>> coordinates) { }
}
