package pl.routecommunity.api.route;
import java.util.Arrays;
import java.util.List;
import org.locationtech.jts.geom.Coordinate;
import org.springframework.stereotype.Component;
@Component
class RouteMapper {
    RouteDto toDto(Route route) {
        List<List<Double>> coordinates=Arrays.stream(route.getTrackGeometry().getCoordinates()).map(this::coordinate).toList();
        return new RouteDto(route.getPublicId(),route.getName(),route.getDescription(),route.getOriginalFilename(),route.getDistanceMeters(),route.getElevationGainMeters(),new RouteDto.GeoJsonLineString("LineString",coordinates),route.getCreatedAt());
    }
    private List<Double> coordinate(Coordinate coordinate){return List.of(coordinate.x,coordinate.y);}
}
