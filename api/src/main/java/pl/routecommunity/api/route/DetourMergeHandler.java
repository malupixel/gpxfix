package pl.routecommunity.api.route;

import java.util.*;
import org.locationtech.jts.geom.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import pl.routecommunity.api.common.error.ApiException;

@Component
class DetourMergeHandler implements SuggestionMergeHandler {
    private static final double EARTH_RADIUS=6_371_000,TOLERANCE_DEGREES=0.00002,TOLERANCE_METERS=2.5;
    private final GeometryFactory geometries=new GeometryFactory(new PrecisionModel(),4326);
    public boolean supports(SuggestionType type){return type==SuggestionType.DETOUR;}
    public LineString apply(RouteSuggestion suggestion,RouteVersion current){
        Coordinate[] base=suggestion.getBaseVersion().getTrackGeometry().getCoordinates(),active=current.getTrackGeometry().getCoordinates();
        double baseStart=basePosition(base,suggestion.getStartPoint().getCoordinate(),suggestion.getStartDistanceMeters());
        double baseEnd=basePosition(base,suggestion.getEndPoint().getCoordinate(),suggestion.getEndDistanceMeters());
        Section baseSection=sectionAtDistances(base,baseStart,baseEnd);
        if(Objects.equals(suggestion.getBaseVersion().getId(),current.getId()))return merge(baseSection,suggestion);
        List<Section> matches=findSections(active,suggestion.getStartPoint().getCoordinate(),suggestion.getEndPoint().getCoordinate()).stream().filter(candidate->same(candidate.coordinates(),baseSection.coordinates())).toList();
        if(matches.size()!=1)throw new ApiException(HttpStatus.CONFLICT,"This suggestion was created on v"+suggestion.getBaseVersion().getVersionNumber()+" and its affected route section has changed. Review it before merging.");
        return merge(matches.get(0),suggestion);
    }
    private LineString merge(Section target,RouteSuggestion suggestion){List<Coordinate> merged=new ArrayList<>();merged.addAll(Arrays.asList(target.prefix()));append(merged,suggestion.getProposedGeometry().getCoordinates());append(merged,target.suffix());
        if(merged.size()<2)throw new ApiException(HttpStatus.CONFLICT,"Suggestion cannot be merged safely");return geometries.createLineString(merged.toArray(Coordinate[]::new));
    }
    private List<Section> findSections(Coordinate[] line,Coordinate start,Coordinate end){List<Double> starts=positions(line,start),ends=positions(line,end);List<Section> sections=new ArrayList<>();for(double from:starts)for(double to:ends)if(to>from+0.01)sections.add(sectionAtDistances(line,from,to));return sections;}
    private double basePosition(Coordinate[] line,Coordinate point,double expected){return positions(line,point).stream().min(Comparator.comparingDouble(value->Math.abs(value-expected))).orElseThrow(()->new ApiException(HttpStatus.CONFLICT,"Suggestion anchors no longer match its base version"));}
    private List<Double> positions(Coordinate[] line,Coordinate point){List<Double> values=new ArrayList<>();double cumulative=0;for(int i=0;i<line.length-1;i++){Coordinate a=line[i],b=line[i+1];Projection p=project(point,a,b);if(distance(point,p.coordinate())<=TOLERANCE_METERS){double value=cumulative+distance(a,b)*p.fraction();if(values.stream().noneMatch(v->Math.abs(v-value)<0.1))values.add(value);}cumulative+=distance(a,b);}return values;}
    private Section sectionAtDistances(Coordinate[] line,double from,double to){double total=length(line);double start=Math.max(0,Math.min(from,total)),end=Math.max(start,Math.min(to,total));List<Coordinate> prefix=coordinatesBetween(line,0,start),middle=coordinatesBetween(line,start,end),suffix=coordinatesBetween(line,end,total);return new Section(prefix.toArray(Coordinate[]::new),middle.toArray(Coordinate[]::new),suffix.toArray(Coordinate[]::new));}
    private List<Coordinate> coordinatesBetween(Coordinate[] line,double from,double to){List<Coordinate> result=new ArrayList<>();double cumulative=0;for(int i=0;i<line.length-1;i++){double leg=distance(line[i],line[i+1]),legEnd=cumulative+leg;if(legEnd+0.001>=from&&cumulative-0.001<=to){double a=leg==0?0:Math.max(0,Math.min(1,(from-cumulative)/leg)),b=leg==0?1:Math.max(0,Math.min(1,(to-cumulative)/leg));if(b>=a){append(result,new Coordinate[]{interpolate(line[i],line[i+1],a)});if(b==1)append(result,new Coordinate[]{line[i+1]});else append(result,new Coordinate[]{interpolate(line[i],line[i+1],b)});}}cumulative=legEnd;if(cumulative>to)break;}return result;}
    private boolean same(Coordinate[] a,Coordinate[] b){if(a.length!=b.length)return false;for(int i=0;i<a.length;i++)if(a[i].distance(b[i])>TOLERANCE_DEGREES)return false;return true;}
    private void append(List<Coordinate> target,Coordinate[] values){for(Coordinate value:values)if(target.isEmpty()||target.getLast().distance(value)>1e-10)target.add(new Coordinate(value));}
    private double length(Coordinate[] values){double result=0;for(int i=1;i<values.length;i++)result+=distance(values[i-1],values[i]);return result;}
    private double distance(Coordinate a,Coordinate b){double lat1=Math.toRadians(a.y),lat2=Math.toRadians(b.y),dlat=lat2-lat1,dlon=Math.toRadians(b.x-a.x);double h=Math.sin(dlat/2)*Math.sin(dlat/2)+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)*Math.sin(dlon/2);return 2*EARTH_RADIUS*Math.asin(Math.sqrt(h));}
    private Projection project(Coordinate p,Coordinate a,Coordinate b){double ref=Math.toRadians((p.y+a.y+b.y)/3),ax=EARTH_RADIUS*Math.toRadians(a.x-p.x)*Math.cos(ref),ay=EARTH_RADIUS*Math.toRadians(a.y-p.y),bx=EARTH_RADIUS*Math.toRadians(b.x-p.x)*Math.cos(ref),by=EARTH_RADIUS*Math.toRadians(b.y-p.y),dx=bx-ax,dy=by-ay,sq=dx*dx+dy*dy;double f=sq==0?0:Math.max(0,Math.min(1,-(ax*dx+ay*dy)/sq));return new Projection(interpolate(a,b,f),f);}
    private Coordinate interpolate(Coordinate a,Coordinate b,double f){return new Coordinate(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f);}
    private record Projection(Coordinate coordinate,double fraction){}
    private record Section(Coordinate[] prefix,Coordinate[] coordinates,Coordinate[] suffix){}
}
