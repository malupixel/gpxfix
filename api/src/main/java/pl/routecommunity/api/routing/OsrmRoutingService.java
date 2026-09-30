package pl.routecommunity.api.routing;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import pl.routecommunity.api.common.error.ApiException;
@Service class OsrmRoutingService implements RoutingService {
 private final RestClient client; OsrmRoutingService(RestClient.Builder builder,@Value("${app.routing.base-url}") String url){client=builder.baseUrl(url).build();}
 public List<List<Double>> route(List<Double> from,List<Double> to){try{Response value=client.get().uri("/route/v1/cycling/{coordinates}?overview=full&geometries=geojson",from.get(0)+","+from.get(1)+";"+to.get(0)+","+to.get(1)).retrieve().body(Response.class);if(value==null||!"Ok".equals(value.code())||value.routes()==null||value.routes().isEmpty())throw new ApiException(HttpStatus.BAD_GATEWAY,"No road route found");return value.routes().get(0).geometry().coordinates();}catch(ApiException e){throw e;}catch(Exception e){throw new ApiException(HttpStatus.BAD_GATEWAY,"Road routing is temporarily unavailable");}}
 record Response(String code,List<Route> routes){} record Route(Geometry geometry){} record Geometry(List<List<Double>> coordinates){}
}
