package pl.routecommunity.api.elevation;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.*;
import org.junit.jupiter.api.Test;
import pl.routecommunity.api.gpx.*;

class RouteElevationEnricherTest {
    @Test void completeImportedProfileIsPreservedWithoutProviderCall(){
        int[] calls={0};ElevationProvider provider=points->{calls[0]++;return List.of();};GpxTrack source=GpxParser.calculateMetrics(List.of(List.of(new GpxPoint(52,21,100.0),new GpxPoint(52.01,21.01,120.0))));
        assertThat(new RouteElevationEnricher(provider,100,500).enrich(source)).isSameAs(source);assertThat(calls[0]).isZero();
    }
    @Test void missingProfileUsesDistanceSamplingAndInterpolatesOntoOriginalGeometry(){
        List<List<ElevationProvider.Coordinate>> requests=new ArrayList<>();ElevationProvider provider=points->{requests.add(List.copyOf(points));List<Double> result=new ArrayList<>();for(int i=0;i<points.size();i++)result.add(100.0+i*10);return result;};
        List<GpxPoint> points=List.of(new GpxPoint(52,21,null),new GpxPoint(52,21.001,null),new GpxPoint(52,21.002,null));GpxTrack enriched=new RouteElevationEnricher(provider,100,500).enrich(GpxParser.calculateMetrics(List.of(points)));
        assertThat(requests).hasSize(1);assertThat(requests.getFirst()).hasSize(3);assertThat(enriched.points()).extracting(GpxPoint::elevationMeters).allMatch(Objects::nonNull);assertThat(enriched.points()).extracting(GpxPoint::longitude).containsExactly(21.0,21.001,21.002);assertThat(enriched.elevationGainMeters()).isPositive();
    }
    @Test void longRoutesHaveABoundedNumberOfProviderSamples(){List<ElevationProvider.Coordinate> requested=new ArrayList<>();ElevationProvider provider=points->{requested.addAll(points);return points.stream().map(point->100.0).toList();};List<GpxPoint> points=List.of(new GpxPoint(52,19,null),new GpxPoint(52,21,null));new RouteElevationEnricher(provider,100,500).enrich(GpxParser.calculateMetrics(List.of(points)));assertThat(requested).hasSizeLessThanOrEqualTo(500);}
}
