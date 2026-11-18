package pl.routecommunity.api.route;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import java.util.*;
import pl.routecommunity.api.gpx.*;

class RouteGeometryTransformTest {
    private GpxPoint p(double x,double y,Double h){return new GpxPoint(y,x,h);}
    private GpxTrack track(GpxPoint...points){return GpxParser.calculateMetrics(List.of(List.of(points)));}
    private final GpxPoint a=p(21,52,100.0),b=p(21.01,52,150.0),c=p(21.01,52.01,120.0),d=p(21,52.01,80.0);
    @Test void reversePreservesEveryVertexElevationAndSegmentsAndSwapsGainLoss(){
        var original=track(a,b,b,c,d);var reversed=RouteGeometryTransform.reverse(original);
        assertThat(reversed.points()).containsExactly(d,c,b,b,a);
        assertThat(reversed.distanceMeters()).isCloseTo(original.distanceMeters(),within(1e-8));
        assertThat(original.elevationGainMeters()).isEqualTo(50);assertThat(reversed.elevationGainMeters()).isEqualTo(70);
        assertThat(RouteGeometryTransform.reverse(reversed)).isEqualTo(original);
        var multi=GpxParser.calculateMetrics(List.of(List.of(a,b),List.of(c,d)));
        assertThat(RouteGeometryTransform.reverse(multi).segments()).containsExactly(List.of(d,c),List.of(b,a));
    }
    @Test void rotateExactLoopAtVertexPreservesDirectionAndLength(){
        var original=track(a,b,c,d,a);var result=RouteGeometryTransform.relocate(original,1,0,List.of());
        assertThat(result.points()).containsExactly(b,c,d,a,b);
        assertThat(result.distanceMeters()).isCloseTo(original.distanceMeters(),within(1e-8));
    }
    @Test void splitInterpolatesElevationAndIncludesBothPartsOnce(){
        var original=track(a,b,c,d,a);var result=RouteGeometryTransform.relocate(original,1,.5,List.of());
        var split=RouteGeometryTransform.interpolate(b,c,.5);
        assertThat(split.elevationMeters()).isEqualTo(135);assertThat(result.points()).containsExactly(split,c,d,a,b,split);
        assertThat(result.distanceMeters()).isCloseTo(original.distanceMeters(),within(.001));
    }
    @Test void openLoopNeedsExplicitValidClosure(){
        var original=track(a,b,c,d);assertThatThrownBy(()->RouteGeometryTransform.relocate(original,1,0,List.of())).hasMessageContaining("closure");
        assertThat(RouteGeometryTransform.relocate(original,1,0,List.of(d,a)).points()).containsExactly(b,c,d,a,b);
        assertThatThrownBy(()->RouteGeometryTransform.relocate(original,1,0,List.of(a,d))).hasMessageContaining("closure");
    }
    @Test void endpointSelectionDoesNotDuplicateSegments(){
        var original=track(a,b,c,d,a);
        assertThat(RouteGeometryTransform.relocate(original,0,0,List.of()).points()).isEqualTo(original.points());
        assertThat(RouteGeometryTransform.relocate(original,3,1,List.of()).points()).isEqualTo(original.points());
        assertThat(RouteGeometryTransform.relocate(original,0,1,List.of()).points()).containsExactly(b,c,d,a,b);
    }
    @Test void repeatedVisitsSelfIntersectionAndTinySegmentsRetainOrder(){
        var near=p(21.000000001,52,100.0);var original=track(a,b,a,c,a,near,a);
        assertThat(RouteGeometryTransform.relocate(original,2,0,List.of()).points()).containsExactly(a,c,a,near,a,b,a);
        assertThat(RouteGeometryTransform.reverse(RouteGeometryTransform.reverse(original))).isEqualTo(original);
    }
    @Test void sameCoordinateWithDifferentElevationsRetainsBothSamples(){
        var end=p(21,52,105.0);var result=RouteGeometryTransform.relocate(track(a,b,c,end),1,0,List.of());
        assertThat(result.points()).containsExactly(b,c,end,a,b);
    }
    @Test void invalidCoordinatesAndEmptyGeometryAreRejected(){
        assertThatThrownBy(()->RouteGeometryTransform.relocate(track(),0,0,List.of())).hasMessageContaining("geometry");
        assertThatThrownBy(()->RouteGeometryTransform.relocate(track(p(Double.NaN,52,null),b),0,.5,List.of())).hasMessageContaining("geometry");
    }
    @Test void profileCutSelectsTheCorrectRepeatedVertexAndInterpolatesDenseSamples(){
        var duplicate=p(a.longitude(),a.latitude(),105.0);
        var map=track(a,duplicate,b,c,a);
        var dense=track(a,duplicate,RouteGeometryTransform.interpolate(duplicate,b,.5),b,c,a);
        var position=RouteGeometryTransform.profilePosition(map,dense,1,0);
        assertThat(position).isEqualTo(new RouteGeometryTransform.Position(1,0));
        assertThat(RouteGeometryTransform.relocate(dense,position.index(),position.fraction(),List.of()).points().getFirst().elevationMeters()).isEqualTo(105);
        var middle=RouteGeometryTransform.profilePosition(map,dense,1,.75);
        assertThat(middle.index()).isEqualTo(2);assertThat(middle.fraction()).isCloseTo(.5,within(1e-10));
        assertThat(RouteGeometryTransform.profilePosition(map,dense,0,.5)).isEqualTo(new RouteGeometryTransform.Position(0,.5));
        assertThat(RouteGeometryTransform.profilePosition(map,dense,3,1)).isEqualTo(new RouteGeometryTransform.Position(4,1));
    }
    @Test void missingElevationsStayMissingAndShortTracksAreHandled(){
        var x=p(21,52,null);var y=p(21.000000001,52,null);var original=track(x,y,x);
        assertThat(RouteGeometryTransform.relocate(original,0,.5,List.of()).elevationGainMeters()).isNull();
        assertThat(RouteGeometryTransform.reverse(original).elevationGainMeters()).isNull();
        assertThatThrownBy(()->RouteGeometryTransform.relocate(original,-1,0,List.of())).hasMessageContaining("position");
        assertThatThrownBy(()->RouteGeometryTransform.relocate(original,0,Double.NaN,List.of())).hasMessageContaining("position");
        assertThatThrownBy(()->RouteGeometryTransform.relocate(original,0,1.1,List.of())).hasMessageContaining("position");
    }
}
