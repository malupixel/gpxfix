package pl.routecommunity.api.routing;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import pl.routecommunity.api.common.error.ApiException;
@RestController @RequestMapping("/api/routing") public class RoutingController {
 private final RoutingService service; RoutingController(RoutingService service){this.service=service;}
 @PostMapping("/route") Result route(@RequestBody Request request){if(request==null||!valid(request.from())||!valid(request.to()))throw new ApiException(HttpStatus.BAD_REQUEST,"Invalid routing coordinates");return new Result(service.route(request.from(),request.to()));}
 private boolean valid(List<Double> c){return c!=null&&c.size()==2&&c.stream().allMatch(v->v!=null&&Double.isFinite(v))&&Math.abs(c.get(0))<=180&&Math.abs(c.get(1))<=90;}
 record Request(List<Double> from,List<Double> to){} record Result(List<List<Double>> coordinates){}
}
