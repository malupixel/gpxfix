package pl.routecommunity.api.elevation;

import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import pl.routecommunity.api.gpx.*;

@Component
public class RouteElevationEnricher {
    private final ElevationProvider provider;private final double intervalMeters;private final int maximumSamples;
    RouteElevationEnricher(ElevationProvider provider,@Value("${app.elevation.sample-interval-meters:100}") double intervalMeters,@Value("${app.elevation.maximum-samples:500}") int maximumSamples){this.provider=provider;this.intervalMeters=intervalMeters;this.maximumSamples=maximumSamples;}
    public GpxTrack enrich(GpxTrack track){
        if(track.points().stream().allMatch(point->point.elevationMeters()!=null))return track;
        List<List<GpxPoint>> enriched=new ArrayList<>();
        for(List<GpxPoint> segment:track.segments())enriched.add(enrichSegment(segment));
        return GpxParser.calculateMetrics(enriched);
    }
    private List<GpxPoint> enrichSegment(List<GpxPoint> points){
        double[] distances=distances(points);double total=distances[distances.length-1];List<Double> sampleDistances=sampleDistances(total);
        List<ElevationProvider.Coordinate> coordinates=sampleDistances.stream().map(distance->{GpxPoint point=pointAt(points,distances,distance);return new ElevationProvider.Coordinate(point.latitude(),point.longitude());}).toList();
        List<Double> elevations=provider.elevations(coordinates);List<GpxPoint> result=new ArrayList<>(points.size());
        for(int i=0;i<points.size();i++){GpxPoint point=points.get(i);result.add(new GpxPoint(point.latitude(),point.longitude(),interpolate(sampleDistances,elevations,distances[i])));}
        return List.copyOf(result);
    }
    private List<Double> sampleDistances(double total){if(total<=0)return List.of(0.0);int sections=Math.max(1,Math.min(maximumSamples-1,(int)Math.ceil(total/intervalMeters)));List<Double> values=new ArrayList<>(sections+1);for(int i=0;i<=sections;i++)values.add(total*i/sections);return values;}
    private double[] distances(List<GpxPoint> points){double[] values=new double[points.size()];for(int i=1;i<points.size();i++)values[i]=values[i-1]+GpxParser.haversineMeters(points.get(i-1),points.get(i));return values;}
    private GpxPoint pointAt(List<GpxPoint> points,double[] distances,double target){int upper=Arrays.binarySearch(distances,target);if(upper>=0)return points.get(upper);upper=-upper-1;if(upper<=0)return points.getFirst();if(upper>=points.size())return points.getLast();double fraction=(target-distances[upper-1])/(distances[upper]-distances[upper-1]);GpxPoint a=points.get(upper-1),b=points.get(upper);return new GpxPoint(a.latitude()+(b.latitude()-a.latitude())*fraction,a.longitude()+(b.longitude()-a.longitude())*fraction,null);}
    private double interpolate(List<Double> distances,List<Double> elevations,double target){int index=Collections.binarySearch(distances,target);if(index>=0)return elevations.get(index);int upper=-index-1;if(upper<=0)return elevations.getFirst();if(upper>=distances.size())return elevations.getLast();double fraction=(target-distances.get(upper-1))/(distances.get(upper)-distances.get(upper-1));return elevations.get(upper-1)+(elevations.get(upper)-elevations.get(upper-1))*fraction;}
}
