package pl.routecommunity.api.route;

import java.util.*;
import org.locationtech.jts.geom.*;
import pl.routecommunity.api.gpx.*;
import org.springframework.http.HttpStatus;
import pl.routecommunity.api.common.error.ApiException;

/** Pure transformations; point order, repeated visits and elevation samples are retained. */
final class RouteGeometryTransform {
    static GpxTrack reverse(GpxTrack source) {
        List<List<GpxPoint>> segments = new ArrayList<>();
        for (var segment : source.segments().reversed()) segments.add(List.copyOf(segment.reversed()));
        return GpxParser.calculateMetrics(segments);
    }
    static double gap(GpxTrack source) { return GpxParser.haversineMeters(source.points().getFirst(), source.points().getLast()); }
    static boolean same(GpxPoint a, GpxPoint b) { return a.longitude()==b.longitude() && a.latitude()==b.latitude(); }
    static GpxTrack relocate(GpxTrack source, int segmentIndex, double fraction, List<GpxPoint> closure) {
        if (source.segments().size()!=1) throw invalid("A loop must have one continuous track segment");
        var points = source.points();
        if(points.size()<2 || points.stream().anyMatch(p->!Double.isFinite(p.latitude())||!Double.isFinite(p.longitude())||Math.abs(p.latitude())>90||Math.abs(p.longitude())>180||p.elevationMeters()!=null&&!Double.isFinite(p.elevationMeters())))throw invalid("Invalid route geometry");
        if (segmentIndex<0 || segmentIndex>=points.size()-1 || !Double.isFinite(fraction) || fraction<0 || fraction>1) throw invalid("Invalid start position");
        GpxPoint a=points.get(segmentIndex), b=points.get(segmentIndex+1);
        GpxPoint split=interpolate(a,b,fraction);
        List<GpxPoint> result=new ArrayList<>(); result.add(split);
        int first= fraction==1 ? segmentIndex+2 : segmentIndex+1;
        result.addAll(points.subList(first,points.size()));
        if (!same(points.getLast(), points.getFirst())) {
            if(closure.size()<2 || !same(closure.getFirst(),points.getLast()) || !same(closure.getLast(),points.getFirst())) throw invalid("Invalid loop closure");
            result.addAll(closure.subList(1,closure.size()));
        }
        // A repeated coordinate can carry a different elevation sample; preserve it.
        else if(!Objects.equals(points.getLast().elevationMeters(),points.getFirst().elevationMeters())) result.add(points.getFirst());
        // The old first coordinate is already present as the last point of the closure.
        result.addAll(points.subList(1,segmentIndex+1));
        if (!same(result.getLast(),split)) result.add(split);
        else result.set(result.size()-1,split);
        if(result.size()<2)throw invalid("Route is too short");
        return GpxParser.calculateMetrics(List.of(List.copyOf(result)));
    }
    record Position(int index,double fraction) { }
    /** Locate the selected occurrence, including zero-length edges, in a denser GPX profile.
     * Elevation enrichment retains all original vertices in their original order. */
    static Position profilePosition(GpxTrack map,GpxTrack profile,int segmentIndex,double fraction) {
        var vertices=map.points();var samples=profile.points();int cursor=0,start=-1,end=-1;
        for(int i=0;i<=segmentIndex+1;i++) {
            while(cursor<samples.size()&&!same(vertices.get(i),samples.get(cursor)))cursor++;
            if(cursor==samples.size())throw invalid("The elevation profile does not match the route geometry");
            if(i==segmentIndex)start=cursor;
            if(i==segmentIndex+1)end=cursor;
            cursor++;
        }
        if(fraction==0)return new Position(start,0);
        if(fraction==1)return end==samples.size()-1?new Position(end-1,1):new Position(end,0);
        double target=planar(vertices.get(segmentIndex),vertices.get(segmentIndex+1))*fraction;
        int index=start;
        while(index<end-1&&target>planar(samples.get(index),samples.get(index+1))){target-=planar(samples.get(index),samples.get(index+1));index++;}
        double length=planar(samples.get(index),samples.get(index+1));
        return new Position(index,length==0?fraction:Math.clamp(target/length,0,1));
    }
    private static double planar(GpxPoint a,GpxPoint b){return Math.hypot(b.longitude()-a.longitude(),b.latitude()-a.latitude());}
    static GpxPoint interpolate(GpxPoint a,GpxPoint b,double f) {
        if(f==0)return a;if(f==1)return b;
        double delta=b.longitude()-a.longitude(); if(delta>180)delta-=360;if(delta< -180)delta+=360;
        double lon=a.longitude()+delta*f; if(lon>180)lon-=360;if(lon< -180)lon+=360;
        return new GpxPoint(a.latitude()+(b.latitude()-a.latitude())*f,lon,a.elevationMeters()==null||b.elevationMeters()==null?null:a.elevationMeters()+(b.elevationMeters()-a.elevationMeters())*f);
    }
    static ApiException invalid(String message){return new ApiException(HttpStatus.BAD_REQUEST,message);}
}
