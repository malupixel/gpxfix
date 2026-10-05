package pl.routecommunity.api.elevation;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.*;
import org.junit.jupiter.api.Test;
import pl.routecommunity.api.gpx.*;

class RouteElevationEnricherTest {
    @Test void completeImportedProfileIsPreservedWithoutProviderCall(){
        int[] calls={0};ElevationProvider provider=points->{calls[0]++;return List.of();};GpxTrack source=GpxParser.calculateMetrics(List.of(List.of(new GpxPoint(52,21,100.0),new GpxPoint(52.01,21.01,120.0))));
        assertThat(new RouteElevationEnricher(provider,100).enrich(source)).isSameAs(source);assertThat(calls[0]).isZero();
    }
    @Test void missingProfileUsesDistanceSamplingAndInterpolatesOntoOriginalGeometry(){
        List<List<ElevationProvider.Coordinate>> requests=new ArrayList<>();ElevationProvider provider=points->{requests.add(List.copyOf(points));List<Double> result=new ArrayList<>();for(int i=0;i<points.size();i++)result.add(100.0+i*10);return result;};
        List<GpxPoint> points=List.of(new GpxPoint(52,21,null),new GpxPoint(52,21.001,null),new GpxPoint(52,21.002,null));GpxTrack enriched=new RouteElevationEnricher(provider,100).enrich(GpxParser.calculateMetrics(List.of(points)));
        assertThat(requests).hasSize(1);assertThat(requests.getFirst()).hasSize(3);assertThat(enriched.points()).extracting(GpxPoint::elevationMeters).allMatch(Objects::nonNull);assertThat(enriched.points()).extracting(GpxPoint::longitude).containsExactly(21.0,21.001,21.002);assertThat(enriched.elevationGainMeters()).isPositive();
    }
    @Test void longSparseRoutesRetainSamplesWithoutTheOld500Limit(){
        for(double kilometres:List.of(137.0,300.0)){
            List<ElevationProvider.Coordinate> requested=new ArrayList<>();ElevationProvider provider=points->{requested.addAll(points);return points.stream().map(point->100.0).toList();};
            List<GpxPoint> points=List.of(new GpxPoint(0,0,null),new GpxPoint(Math.toDegrees(kilometres*1000/6_371_008.8),0,null));
            GpxTrack enriched=new RouteElevationEnricher(provider,100).enrich(GpxParser.calculateMetrics(List.of(points)));
            assertThat(requested.size()).isBetween((int)(kilometres*10)+1,(int)(kilometres*10)+2);
            assertThat(enriched.points()).hasSize(requested.size());assertThat(enriched.points().getFirst().latitude()).isEqualTo(0);
            assertThat(enriched.points().getLast().latitude()).isEqualTo(points.getLast().latitude());
            for(int i=1;i<enriched.points().size();i++)assertThat(GpxParser.haversineMeters(enriched.points().get(i-1),enriched.points().get(i))).isLessThanOrEqualTo(100.00001);
        }
    }
    @Test void partialGpxKeepsExistingElevationsAndOriginalPoints(){
        GpxPoint original=new GpxPoint(52.01,21.01,321.0);
        GpxTrack source=GpxParser.calculateMetrics(List.of(List.of(new GpxPoint(52,21,null),original,new GpxPoint(52.02,21.02,null))));
        GpxTrack result=new RouteElevationEnricher(coordinates->coordinates.stream().map(point->100.0).toList(),100).enrich(source);
        assertThat(result.points()).contains(original);assertThat(result.points()).extracting(GpxPoint::elevationMeters).doesNotContainNull();
    }
}
