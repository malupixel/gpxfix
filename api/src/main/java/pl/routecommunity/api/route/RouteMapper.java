package pl.routecommunity.api.route;
import java.util.Arrays;
import java.util.List;
import org.locationtech.jts.geom.Coordinate;
import org.springframework.stereotype.Component;
import pl.routecommunity.api.gpx.GpxPoint;
import pl.routecommunity.api.gpx.GpxParser;
import pl.routecommunity.api.gpx.GpxTrack;
@Component
class RouteMapper {
    RouteDto toDto(Route route, GpxTrack track) {
        List<List<Double>> coordinates=Arrays.stream(route.getTrackGeometry().getCoordinates()).map(this::coordinate).toList();
        return new RouteDto(route.getPublicId(),route.getName(),route.getDescription(),route.getOriginalFilename(),route.getDistanceMeters(),route.getElevationGainMeters(),new RouteDto.GeoJsonLineString("LineString",coordinates),elevationProfile(track),route.getCreatedAt());
    }
    private List<RouteDto.ElevationSample> elevationProfile(GpxTrack track) {
        java.util.ArrayList<RouteDto.ElevationSample> samples=new java.util.ArrayList<>(); double distance=0;
        for(List<GpxPoint> segment:track.segments()) for(int i=0;i<segment.size();i++) {
            GpxPoint point=segment.get(i); if(i>0) distance+=GpxParser.haversineMeters(segment.get(i-1),point);
            samples.add(new RouteDto.ElevationSample(distance,point.elevationMeters(),point.longitude(),point.latitude()));
        }
        return List.copyOf(samples);
    }
    private List<Double> coordinate(Coordinate coordinate){return List.of(coordinate.x,coordinate.y);}
}
