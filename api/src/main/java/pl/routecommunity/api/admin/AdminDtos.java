package pl.routecommunity.api.admin;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Administrative projections deliberately exclude owner credentials and full geometry. */
public final class AdminDtos {
    private AdminDtos() { }
    public record Page<T>(List<T> items, long total, int page, int size) { }
    public record RouteRow(long id, String publicId, String name, Instant createdAt, Instant updatedAt,
            double distanceKm, long versionCount, long suggestionCount, Instant deletedAt) { }
    public record SuggestionRow(long id, String publicId, long routeId, String routePublicId, String routeName,
            String type, String moderationStatus, String integrationStatus, String applicability,
            String description, Instant createdAt) { }
    public record VersionRow(long id, int number, String source, Instant createdAt, double distanceKm,
            String originalFilename, String storageKey) { }
    public record ActivityRow(String id, long routeId, String routePublicId, String type, Instant occurredAt, String actorKind) { }
    public record FileRow(String kind, String key, boolean exists, Long bytes) { }
    public record RouteDetails(RouteRow route, String description, String originalUploadFilename, String originalUploadStorageKey, boolean suggestionsEnabled,
            String sourceType, int pointCount, int srid, boolean geometryValid, String boundingBox,
            long commentCount, long activityCount, List<FileRow> files) { }
    public record Dashboard(long totalRoutes, long activeRoutes, long deletedRoutes, long created7Days,
            long created30Days, long totalSuggestions, Map<String,Long> suggestionStatuses,
            long totalVersions, List<RouteRow> recentRoutes, List<ActivityRow> recentActivity) { }
    public record SystemStatus(String apiStatus, String backendVersion, boolean databaseConnected,
            long databaseBytes, long referencedGpxFiles, long previewRecords, boolean permanentDeleteEnabled) { }
    public record DeletePlan(long routeId, long versions, long suggestions, long comments, long activity,
            long ownerSessions, long previewJobs, List<FileRow> files, boolean executable, List<String> warnings) { }
    public record StatusChange(@NotNull Boolean deleted, @NotNull Boolean expectedDeleted,
            @NotNull @Size(max=200) String confirmationName) { }
    public record BulkDelete(@NotEmpty @Size(max=100) List<@NotNull @Positive Long> routeIds,
            @AssertTrue boolean confirmed) { }
    public record MutationResult(int changed) { }
}
