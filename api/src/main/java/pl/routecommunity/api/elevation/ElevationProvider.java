package pl.routecommunity.api.elevation;

import java.util.List;

public interface ElevationProvider {
    /** One finite height (metres) per coordinate, in input order; incomplete batches must fail. */
    List<Double> elevations(List<Coordinate> coordinates);
    /** Attribution/legal notice to preserve when distributing derived data. */
    default String attribution(){return null;}
    record Coordinate(double latitude,double longitude){}
}
