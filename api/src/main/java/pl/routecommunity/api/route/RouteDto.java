package pl.routecommunity.api.route;
import java.time.Instant;
import java.util.List;
public record RouteDto(String publicId,String name,String description,String originalFilename,double distanceMeters,Double elevationGainMeters,
        GeoJsonLineString geometry,List<ElevationSample> elevationProfile,Instant createdAt,int currentVersion,int viewedVersion,boolean isCurrentVersion,Instant updatedAt,Instant versionCreatedAt,int versionCount,RouteVersionSource creationSource,boolean suggestionsEnabled,boolean originalAvailable) {
    public record GeoJsonLineString(String type,List<List<Double>> coordinates) { }
    public record ElevationSample(double distanceMeters,Double elevationMeters,double longitude,double latitude) { }
}
