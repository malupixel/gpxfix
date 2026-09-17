package pl.routecommunity.api.gpx;
import java.util.List;
public record GpxTrack(List<List<GpxPoint>> segments, double distanceMeters, Double elevationGainMeters) {
    public List<GpxPoint> points() { return segments.stream().flatMap(List::stream).toList(); }
}
