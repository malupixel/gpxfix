package pl.routecommunity.api.route;
import java.util.List;
public record CreateDrawnRouteRequest(String name,String description,EditorDocument editorDocument){
 public record EditorDocument(int version,List<ControlPoint> points,List<Segment> segments){}
 public record ControlPoint(String id,List<Double> coordinate){}
 public record Segment(String id,String fromId,String toId,String mode,List<List<Double>> geometry,List<List<Double>> intendedGeometry){}
}
