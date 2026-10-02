package pl.routecommunity.api.route;
import java.time.Instant;
public record RouteVersionSummaryDto(int versionNumber,Instant createdAt,RouteVersionSource source,Integer basedOnVersionNumber,String mergedSuggestionPublicId,boolean current) { }
