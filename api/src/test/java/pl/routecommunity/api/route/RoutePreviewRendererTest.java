package pl.routecommunity.api.route;

import static org.assertj.core.api.Assertions.*;
import java.awt.*;
import java.awt.geom.Point2D;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.locationtech.jts.geom.Coordinate;
import pl.routecommunity.api.gpx.*;

class RoutePreviewRendererTest {
    @TempDir Path temp;
    private GpxPoint point(double lat, double lon) { return new GpxPoint(lat,lon,null); }
    private GpxTrack track(List<GpxPoint> points) { return GpxParser.calculateMetrics(List.of(points)); }

    @Test void boundsFitShortLongLoopDegenerateAndExtremeAspectRoutes() {
        for (var points : fixtures()) {
            var fit = RoutePreviewViewport.fit(track(points));
            assertThat(fit.segments()).hasSize(1);
            for (var p : fit.segments().getFirst()) {
                assertThat(p.x).isBetween(561.99,1098.01);
                assertThat(p.y).isBetween(171.99,478.01);
            }
            assertThat(fit.segments().getFirst().getFirst()).isNotNull();
            assertThat(fit.segments().getFirst().getLast()).isNotNull();
        }
    }
    @Test void projectionPreservesMercatorAspectAndNorthernLatitudesAreNotRawCartesianDegrees() {
        var a = point(60,21);var b = point(60.01,21.01);
        var fit = RoutePreviewViewport.fit(track(List.of(a,b))).segments().getFirst();
        double aspect = Math.abs((fit.getLast().y-fit.getFirst().y)/(fit.getLast().x-fit.getFirst().x));
        assertThat(aspect).isCloseTo(2,within(0.001)); // raw lat/lon drawing would give 1
        assertThat(fit.getLast().y).isLessThan(fit.getFirst().y); // north is up
    }
    @Test void antimeridianUnwrapsEachSegmentWithoutStretchingOrJoiningSegments() {
        var fit = RoutePreviewViewport.fit(GpxParser.calculateMetrics(List.of(
                List.of(point(10,179.9),point(10.1,-179.9)),
                List.of(point(10.2,-179.8),point(10.3,-179.7)))));
        assertThat(fit.segments()).hasSize(2);
        var first = fit.segments().getFirst();
        assertThat(first.getLast().x).isGreaterThan(first.getFirst().x);
        assertThat(first.getLast().x-first.getFirst().x).isLessThan(220);
        assertThat(fit.segments().getLast().getFirst().x).isGreaterThan(first.getLast().x);
    }
    @Test void simplificationReducesDensePathsKeepsCornersEndpointsAndClosedLoopsWithinPixelTolerance() {
        var dense = new ArrayList<Point2D.Double>();
        for(int i=0;i<=10000;i++) dense.add(new Point2D.Double(i/20.0,Math.sin(i/100.0)*0.3));
        var simple = RoutePreviewViewport.simplify(dense,0.7);
        assertThat(simple).hasSize(2);assertThat(simple.getFirst()).isEqualTo(dense.getFirst());assertThat(simple.getLast()).isEqualTo(dense.getLast());
        var loop=List.of(new Point2D.Double(0,0),new Point2D.Double(0,100),new Point2D.Double(100,100),new Point2D.Double(100,0),new Point2D.Double(0,0));
        assertThat(RoutePreviewViewport.simplify(loop,0.7)).containsExactlyElementsOf(loop);
        var zigzag = new ArrayList<Point2D.Double>();for(int i=0;i<200;i++)zigzag.add(new Point2D.Double(i,Math.sin(i/10.0)*10));
        var reduced=RoutePreviewViewport.simplify(zigzag,0.7);assertThat(reduced.size()).isLessThan(zigzag.size());
        for(var p:zigzag){double nearest=Double.POSITIVE_INFINITY;for(int i=1;i<reduced.size();i++)nearest=Math.min(nearest,java.awt.geom.Line2D.ptSegDist(reduced.get(i-1).x,reduced.get(i-1).y,reduced.get(i).x,reduced.get(i).y,p.x,p.y));assertThat(nearest).isLessThanOrEqualTo(0.700001);}
    }
    @Test void databaseCoordinatesAreUsedWhileGpxOnlyDeterminesSegmentBoundaries() {
        var boundaries=GpxParser.calculateMetrics(List.of(List.of(point(52,21),point(52.5,21.5),point(53,22)),List.of(point(54,23),point(54.5,23.5),point(55,24))));
        var coordinates=new Coordinate[]{new Coordinate(21,52),new Coordinate(22,53),new Coordinate(23,54),new Coordinate(24,55)};
        var data=RoutePreviewWorker.databaseTrack(coordinates,boundaries);
        assertThat(data.segments()).hasSize(2);assertThat(data.segments().getFirst()).containsExactly(point(52,21),point(53,22));
        assertThat(data.segments().getLast()).containsExactly(point(54,23),point(55,24));
        assertThatThrownBy(()->RoutePreviewWorker.databaseTrack(java.util.Arrays.copyOf(coordinates,3),boundaries)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void disconnectedSegmentsDoNotProduceAnArtificialBridgeInThePng() throws Exception {
        var renderer=new RoutePreviewRenderer();
        var route=GpxParser.calculateMetrics(List.of(List.of(point(52,21),point(52.01,21.01)),List.of(point(53,22),point(53.01,22.01))));
        var fitted=RoutePreviewViewport.fit(route);var a=fitted.segments().getFirst().getLast();var b=fitted.segments().getLast().getFirst();
        var image=ImageIO.read(new ByteArrayInputStream(renderer.render("Segments",route,10.0,null)));
        Color midpoint=new Color(image.getRGB((int)((a.x+b.x)/2),(int)((a.y+b.y)/2)));
        assertThat(midpoint.getGreen()).isLessThan(120); // the route itself is bright green (225)
    }
    @Test void generatesLocalPngForAllShapesPolishEnglishAndLiteralMarkupWithoutExternalServices() throws Exception {
        var renderer=new RoutePreviewRenderer();int i=0;
        for(var points:fixtures()) {
            var t=track(points);var bytes=renderer.render(i%2==0?"Łódź — Zażółć gęślą jaźń":"A long weekend ride",t,t.distanceMeters(),1234.0);
            var image=ImageIO.read(new ByteArrayInputStream(bytes));assertThat(image.getWidth()).isEqualTo(1200);assertThat(image.getHeight()).isEqualTo(630);
            assertThat(bytes).isNotEqualTo(renderer.fallback());sample("route-"+i++,bytes);
        }
        var dateline=track(List.of(point(10,179.9),point(10.1,-179.9),point(10.15,-179.95),point(10,179.9)));
        sample("dateline",renderer.render("Across the date line",dateline,42123.0,null));
        var loop=track(List.of(point(52,21),point(52.02,21.01),point(52.04,21.06),point(52.03,21.085),point(52.015,21.055),point(52,21)));
        sample("loop",renderer.render("Mazury — pętla przez las",loop,42123.0,234.0));
        var longTitle="<svg onload='alert(1)'>Łódź & Żółć 🚲 ".repeat(20);
        sample("long-title",renderer.render(longTitle,loop,Double.NaN,null));
        sample("fallback",renderer.fallback());
        var graphics=imageGraphics();
        try {
            graphics.setFont(new Font(Font.SANS_SERIF,Font.BOLD,39));
            assertThat(graphics.getFont().canDisplayUpTo("Łódź — Zażółć gęślą jaźń")).isEqualTo(-1);
            var lines=RoutePreviewRenderer.wrap(graphics,longTitle,414,4);assertThat(lines).hasSize(4);
            for(var line:lines)assertThat(graphics.getFontMetrics().stringWidth(line)).isLessThanOrEqualTo(414);
            assertThat(lines.getLast()).endsWith("…");
        } finally {graphics.dispose();}
    }
    @Test void missingOrInvalidStatsAreOmittedAndInvalidGeometryCanFallBack() throws Exception {
        var renderer=new RoutePreviewRenderer();var t=track(List.of(point(52,21),point(53,22)));
        assertThat(renderer.render("No stats",t,null,null)).isEqualTo(renderer.render("No stats",t,Double.NaN,-10.0));
        assertThat(renderer.render("No stats",t,0.0,0.0)).isNotEqualTo(renderer.render("No stats",t,null,null));
        var fallback=ImageIO.read(new ByteArrayInputStream(renderer.fallback()));assertThat(fallback.getWidth()).isEqualTo(1200);assertThat(fallback.getHeight()).isEqualTo(630);
        assertThatThrownBy(()->renderer.render("Invalid",new GpxTrack(List.of(List.of()),0,null),null,null)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void storageAndStyleRevisionInvalidatePreviousImagesWithoutChangingRouteVersions() throws Exception {
        var store=new RoutePreviewStore(temp);String first=RoutePreviewRenderer.revision(1,"Route");
        String legacy=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest("preview-v1\n1\nRoute".getBytes(StandardCharsets.UTF_8)));
        assertThat(first).isNotEqualTo(legacy).isNotEqualTo(RoutePreviewRenderer.revision(2,"Route")).isNotEqualTo(RoutePreviewRenderer.revision(1,"Renamed"));
        assertThat(store.read(first)).isNull();store.write(first,new byte[]{1,2,3});assertThat(store.read(first)).containsExactly(1,2,3);
        assertThatThrownBy(()->store.read("../private")).isInstanceOf(IllegalArgumentException.class);
    }
    private Graphics2D imageGraphics(){return new java.awt.image.BufferedImage(1200,630,java.awt.image.BufferedImage.TYPE_INT_RGB).createGraphics();}
    private void sample(String name,byte[] bytes) throws Exception {
        String directory=System.getProperty("preview.samples");
        if(directory!=null){var root=Path.of(directory);Files.createDirectories(root);Files.write(root.resolve(name+".png"),bytes);}
    }
    private List<List<GpxPoint>> fixtures(){return List.of(
        List.of(point(52,21),point(52.001,21.001)),
        List.of(point(40,-5),point(55,21),point(60,35)),
        List.of(point(52,21),point(52.1,21),point(52.1,21.1),point(52,21)),
        List.of(point(0,-120),point(0,-20),point(0,120)),
        List.of(point(-80,21),point(80,21)),
        List.of(point(52,21),point(52,21)));}
}
