package pl.routecommunity.api.routing;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import pl.routecommunity.api.common.error.ApiException;
@RestController @RequestMapping("/api/routing") public class RoutingController {
 private final RoutingService service; RoutingController(RoutingService service){this.service=service;}
 @PostMapping("/route") RoutingService.MatchedRoute route(@RequestBody Request request){
   var points=request==null?null:request.points()!=null?request.points():java.util.Arrays.asList(request.from(),request.to());
   if(points==null||points.size()<2||points.size()>100||!points.stream().allMatch(RoutingController::valid))throw new ApiException(HttpStatus.BAD_REQUEST,"Invalid routing coordinates");
   return service.matched(points);
 }
 public static boolean valid(List<Double> c){return c!=null&&c.size()==2&&c.stream().allMatch(v->v!=null&&Double.isFinite(v))&&Math.abs(c.get(0))<=180&&Math.abs(c.get(1))<=90;}
 record Request(List<Double> from,List<Double> to,List<List<Double>> points){}
}
