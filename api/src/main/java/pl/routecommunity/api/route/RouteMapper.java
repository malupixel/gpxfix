package pl.routecommunity.api.route;
import java.util.*;
import org.locationtech.jts.geom.Coordinate;
import org.springframework.stereotype.Component;
import pl.routecommunity.api.gpx.*;
@Component
class RouteMapper {
    RouteDto toDto(Route route,RouteVersion version,GpxTrack track) {
        List<List<Double>> coordinates=Arrays.stream(version.getTrackGeometry().getCoordinates()).map(this::coordinate).toList();
        return new RouteDto(route.getPublicId(),version.getName(),version.getDescription(),version.getOriginalFilename(),version.getDistanceMeters(),track.elevationGainMeters(),
                new RouteDto.GeoJsonLineString("LineString",coordinates),elevationProfile(track),version.getCreatedAt(),route.getCurrentVersion().getVersionNumber(),version.getVersionNumber(),version.getId().equals(route.getCurrentVersion().getId()));
    }
    RouteVersionSummaryDto summary(Route route,RouteVersion version){return new RouteVersionSummaryDto(version.getVersionNumber(),version.getCreatedAt(),version.getSource(),
            version.getBasedOnVersion()==null?null:version.getBasedOnVersion().getVersionNumber(),version.getMergedSuggestion()==null?null:version.getMergedSuggestion().getPublicId(),version.getId().equals(route.getCurrentVersion().getId()));}
    private List<RouteDto.ElevationSample> elevationProfile(GpxTrack track){ArrayList<RouteDto.ElevationSample> samples=new ArrayList<>();double distance=0;for(List<GpxPoint> segment:track.segments())for(int i=0;i<segment.size();i++){GpxPoint point=segment.get(i);if(i>0)distance+=GpxParser.haversineMeters(segment.get(i-1),point);samples.add(new RouteDto.ElevationSample(distance,point.elevationMeters(),point.longitude(),point.latitude()));}return List.copyOf(samples);}
    private List<Double> coordinate(Coordinate coordinate){return List.of(coordinate.x,coordinate.y);}
}
