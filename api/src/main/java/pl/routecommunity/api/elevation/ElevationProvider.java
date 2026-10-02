package pl.routecommunity.api.elevation;

import java.util.List;

public interface ElevationProvider {
    List<Double> elevations(List<Coordinate> coordinates);
    record Coordinate(double latitude,double longitude){}
}
