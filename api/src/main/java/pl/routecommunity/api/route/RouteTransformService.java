package pl.routecommunity.api.route;

import java.util.*;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.locationtech.jts.geom.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.routecommunity.api.common.error.ApiException;
import pl.routecommunity.api.gpx.*;
import pl.routecommunity.api.routing.RoutingService;
import pl.routecommunity.api.storage.FileStorage;

@Service
class RouteTransformService {
    private final RouteRepository routes; private final RouteBranches branches; private final FileStorage storage;
    private final GpxParser parser; private final RouteVersionCreationService creation; private final RouteMapper mapper;
    private final pl.routecommunity.api.elevation.RouteElevationEnricher elevations;
    private final RoutingService routing; private final ObjectMapper json;
    private final double loopThreshold, maxRatio, endpointTolerance;
    RouteTransformService(RouteRepository routes, RouteBranches branches, FileStorage storage, GpxParser parser,
            RouteVersionCreationService creation, RouteMapper mapper, RoutingService routing, ObjectMapper json, pl.routecommunity.api.elevation.RouteElevationEnricher elevations,
            @Value("${app.routing.loop-threshold-meters}") double loopThreshold,
            @Value("${app.routing.max-closure-ratio}") double maxRatio,
            @Value("${app.routing.closure-endpoint-tolerance-meters}") double endpointTolerance) {
        if(!Double.isFinite(loopThreshold)||loopThreshold<=0||!Double.isFinite(maxRatio)||maxRatio<1||!Double.isFinite(endpointTolerance)||endpointTolerance<0)throw new IllegalArgumentException("Invalid loop limits");
        this.elevations=elevations;this.routes=routes;this.branches=branches;this.storage=storage;this.parser=parser;this.creation=creation;this.mapper=mapper;this.routing=routing;this.json=json;
        this.loopThreshold=loopThreshold;this.maxRatio=maxRatio;this.endpointTolerance=endpointTolerance;
    }
    record Request(int baseVersionNumber, String operation, Integer segmentIndex, Double segmentFraction,
                   boolean declareLoop, boolean reverse, boolean directClosure, String previewHash) { }
    record Preview(List<List<Double>> coordinates, List<List<Double>> closure, double addedDistanceMeters,
                   double distanceMeters, Double elevationGainMeters, Double elevationLossMeters, String previewHash) { }
    record Options(boolean automaticLoop, boolean declaredLoop, double gapMeters, double thresholdMeters) { }
    private record Plan(GpxTrack track, LineString geometry, String definition, boolean loop, Preview preview) { }
    @Transactional(readOnly=true) Options options(String id) {
        Route route=routes.findByPublicId(id).orElseThrow(()->missing());var version=branches.current(route);
        double gap=RouteGeometryTransform.gap(mapTrack(version));return new Options(gap<=loopThreshold,version.isLoopDeclared(),gap,loopThreshold);
    }
    @Transactional(readOnly=true) Preview preview(String id,Request request) {
        Route route=routes.findByPublicId(id).orElseThrow(()->missing());return plan(branches.current(route),request).preview();
    }
    @Transactional RouteDto apply(String id,Request request) {
        Route route=routes.findLockedByPublicId(id).orElseThrow(()->missing());var base=branches.current(route);Plan plan=plan(base,request);
        if(request.previewHash()==null||!request.previewHash().equals(plan.preview().previewHash()))throw new ApiException(HttpStatus.CONFLICT,"Transform preview changed. Review it again before saving.");
        var created=creation.transform(route,base,plan.track(),plan.geometry(),plan.definition(),plan.loop(),plan.preview().distanceMeters());
        return mapper.toDto(route,created.version(),created.track());
    }
    private Plan plan(RouteVersion base,Request r) {
        if(r==null||r.baseVersionNumber()!=base.getVersionNumber())throw new ApiException(HttpStatus.CONFLICT,"The route version changed. Reload before saving.");
        GpxTrack map=mapTrack(base),track=parser.parse(storage.load(base.getStorageKey()));
        GpxTrack resultMap,resultTrack; List<GpxPoint> closure=List.of();String definition=null;boolean loop=base.isLoopDeclared();
        if("REVERSE".equals(r.operation())) {
            resultMap=RouteGeometryTransform.reverse(map);resultTrack=RouteGeometryTransform.reverse(track);definition=reverseDefinition(base.getEditorDefinition());
        } else if("RELOCATE".equals(r.operation())) {
            if(!r.declareLoop()&&!base.isLoopDeclared()&&RouteGeometryTransform.gap(map)>loopThreshold)throw RouteGeometryTransform.invalid("Explicit loop declaration required");
            if(r.segmentIndex()==null||r.segmentFraction()==null)throw RouteGeometryTransform.invalid("Select a new start on the route");
            if(track.segments().size()!=1)throw RouteGeometryTransform.invalid("A loop must have one continuous track segment");
            GpxPoint start=track.points().getFirst(),end=track.points().getLast();
            if(!RouteGeometryTransform.same(start,end))closure=closure(end,start,r.directClosure());
            resultMap=RouteGeometryTransform.relocate(map,r.segmentIndex(),r.segmentFraction(),closure);
            var profilePosition=RouteGeometryTransform.profilePosition(map,track,r.segmentIndex(),r.segmentFraction());
            resultTrack=RouteGeometryTransform.relocate(track,profilePosition.index(),profilePosition.fraction(),closure);
            // Identical START/META in GPX and PostGIS, even with dense elevation sampling.
            var split=resultMap.points().getFirst();var elevated=resultTrack.points().getFirst();
            var exactSplit=new GpxPoint(split.latitude(),split.longitude(),elevated.elevationMeters());
            var exact=new ArrayList<>(resultTrack.points());exact.set(0,exactSplit);exact.set(exact.size()-1,exactSplit);resultTrack=GpxParser.calculateMetrics(List.of(exact));
            if(r.reverse()){resultMap=RouteGeometryTransform.reverse(resultMap);resultTrack=RouteGeometryTransform.reverse(resultTrack);}
            loop=true;
        } else throw RouteGeometryTransform.invalid("Unknown geometry operation");
        var geometry=base.getTrackGeometry().getFactory().createLineString(resultMap.points().stream().map(p->new Coordinate(p.longitude(),p.latitude())).toArray(Coordinate[]::new));
        var coordinates=coordinates(resultMap.points());var closureCoordinates=coordinates(closure);
        String hash=hash(base.getVersionNumber()+":"+r.operation()+":"+loop+":"+r.reverse()+":"+r.directClosure()+":"+resultTrack.segments()+":"+coordinates);
        Preview preview=new Preview(coordinates,closureCoordinates,closure.isEmpty()?0:GpxParser.calculateMetrics(List.of(closure)).distanceMeters(),("REVERSE".equals(r.operation())?base.getDistanceMeters():resultMap.distanceMeters()),resultTrack.elevationGainMeters(),RouteGeometryTransform.reverse(resultTrack).elevationGainMeters(),hash);
        return new Plan(resultTrack,geometry,definition,loop,preview);
    }
    private List<GpxPoint> closure(GpxPoint end,GpxPoint start,boolean direct) {
        if(direct)return List.of(end,start);
        var coordinates=routing.route(List.of(end.longitude(),end.latitude()),List.of(start.longitude(),start.latitude()));
        if(coordinates==null||coordinates.size()<2||!coordinates.stream().allMatch(pl.routecommunity.api.routing.RoutingController::valid))throw closureError();
        List<GpxPoint> points=new ArrayList<>(coordinates.stream().map(p->new GpxPoint(p.get(1),p.get(0),null)).toList());
        if(GpxParser.haversineMeters(points.getFirst(),end)>endpointTolerance||GpxParser.haversineMeters(points.getLast(),start)>endpointTolerance)throw closureError();
        // Only sub-metre numerical endpoint differences may be joined automatically.
        points.set(0,end);points.set(points.size()-1,start);
        double distance=GpxParser.calculateMetrics(List.of(points)).distanceMeters();
        if(distance>Math.max(1, GpxParser.haversineMeters(end,start))*maxRatio)throw closureError();
        return elevations.enrich(GpxParser.calculateMetrics(List.of(points))).points();
    }
    private GpxTrack mapTrack(RouteVersion base) {return GpxParser.calculateMetrics(List.of(Arrays.stream(base.getTrackGeometry().getCoordinates()).map(p->new GpxPoint(p.y,p.x,null)).toList()));}
    private List<List<Double>> coordinates(List<GpxPoint> points){return points.stream().map(p->List.of(p.longitude(),p.latitude())).toList();}
    private String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    private String reverseDefinition(String value) {
        if(value==null)return null;
        try {
            var d=json.readValue(value,CreateDrawnRouteRequest.EditorDocument.class);
            var points=new ArrayList<>(d.points().reversed());var segments=new ArrayList<CreateDrawnRouteRequest.Segment>();
            for(var s:d.segments().reversed())segments.add(new CreateDrawnRouteRequest.Segment(s.id(),s.toId(),s.fromId(),s.mode(),s.geometry().reversed(),s.intendedGeometry()==null?null:s.intendedGeometry().reversed()));
            return json.writeValueAsString(new CreateDrawnRouteRequest.EditorDocument(1,points,segments));
        }catch(Exception e){throw new IllegalStateException("Invalid saved editor document",e);}
    }
    private ApiException closureError(){return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,"Unsafe loop closure: routing failed, endpoints are off road, or detour is too long. Review an explicit direct closure instead.");}
    private ApiException missing(){return new ApiException(HttpStatus.NOT_FOUND,"Route not found");}
}
