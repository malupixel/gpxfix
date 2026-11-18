package pl.routecommunity.api.routing;

import java.util.*;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import pl.routecommunity.api.common.error.ApiException;
import pl.routecommunity.api.gpx.*;

@Service
class OsrmRoutingService implements RoutingService {
    private final RestClient client;
    private final String profile;
    private final double maxSnapMeters;
    OsrmRoutingService(RestClient.Builder builder, @Value("${app.routing.base-url}") String url,
            @Value("${app.routing.profile:cycling}") String profile,
            @Value("${app.routing.max-snap-meters:50}") double maxSnapMeters) {
        if (!Double.isFinite(maxSnapMeters) || maxSnapMeters <= 0) throw new IllegalArgumentException("Invalid snap limit");
        client = builder.baseUrl(url).build(); this.profile = profile; this.maxSnapMeters = maxSnapMeters;
    }
    public List<List<Double>> route(List<Double> from, List<Double> to) { return matched(List.of(from, to)).coordinates(); }
    public MatchedRoute matched(List<List<Double>> points) {
        try {
            String coordinates = points.stream().map(p -> p.get(0) + "," + p.get(1)).collect(Collectors.joining(";"));
            String radiuses = points.stream().map(p -> Double.toString(maxSnapMeters)).collect(Collectors.joining(";"));
            Response value = client.get().uri("/route/v1/{profile}/{coordinates}?overview=full&geometries=geojson&steps=true&radiuses={radiuses}", profile, coordinates, radiuses).retrieve().body(Response.class);
            if (value == null || !"Ok".equals(value.code()) || value.routes() == null || value.routes().isEmpty()
                    || value.waypoints() == null || value.waypoints().size() != points.size()) throw unavailable();
            var matched = value.waypoints().stream().map(Waypoint::location).toList();
            for (int i = 0; i < points.size(); i++) {
                if (!RoutingController.valid(matched.get(i)) || distance(points.get(i), matched.get(i)) > maxSnapMeters) throw unavailable();
            }
            Route route = value.routes().getFirst();
            if (route.legs() == null || route.legs().size() != points.size() - 1) throw unavailable();
            List<List<List<Double>>> segments = new ArrayList<>();
            for (int i = 0; i < route.legs().size(); i++) {
                List<List<Double>> line = new ArrayList<>();
                for (Step step : route.legs().get(i).steps()) for (var p : step.geometry().coordinates()) {
                    if (!RoutingController.valid(p)) throw unavailable();
                    if(line.isEmpty()&&matched.get(i).equals(matched.get(i+1)))line.add(matched.get(i));
                if (line.isEmpty() || !line.getLast().equals(p)) line.add(p);
                }
                if(line.isEmpty()&&matched.get(i).equals(matched.get(i+1)))line.add(matched.get(i));
                if (line.isEmpty() || !line.getFirst().equals(matched.get(i)) || !line.getLast().equals(matched.get(i+1))) throw unavailable();
                if (line.size() == 1) line.add(line.getFirst());
                segments.add(List.copyOf(line));
            }
            List<List<Double>> geometry = new ArrayList<>(segments.getFirst());
            for (int i=1; i<segments.size(); i++) geometry.addAll(segments.get(i).subList(1, segments.get(i).size()));
            return new MatchedRoute(geometry, matched, segments);
        } catch (ApiException e) { throw e; }
        catch (Exception e) { throw unavailable(); }
    }
    private ApiException unavailable() { return new ApiException(HttpStatus.BAD_GATEWAY, "Road routing could not safely match points within the snap limit"); }
    private double distance(List<Double> a, List<Double> b) { return GpxParser.haversineMeters(new GpxPoint(a.get(1), a.get(0), null), new GpxPoint(b.get(1), b.get(0), null)); }
    record Response(String code, List<Route> routes, List<Waypoint> waypoints) { }
    record Waypoint(List<Double> location) { }
    record Route(Geometry geometry, List<Leg> legs) { }
    record Leg(List<Step> steps) { }
    record Step(Geometry geometry) { }
    record Geometry(List<List<Double>> coordinates) { }
}
