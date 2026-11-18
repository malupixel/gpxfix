package pl.routecommunity.api.routing;
import java.util.List;
public interface RoutingService {
    List<List<Double>> route(List<Double> from, List<Double> to);
    MatchedRoute matched(List<List<Double>> points);
    record MatchedRoute(List<List<Double>> coordinates, List<List<Double>> waypoints, List<List<List<Double>>> segments) { }
}
