package pl.routecommunity.api.route;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record RouteActivityDto(UUID id, String type, Instant occurredAt, Integer versionNumber,
        String suggestionPublicId, String commentPublicId, String actorKind, String actorName, Map<String,String> metadata) {
    public record Page(List<RouteActivityDto> items, String nextCursor) { }
}
