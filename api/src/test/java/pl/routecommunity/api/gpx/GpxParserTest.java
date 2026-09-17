package pl.routecommunity.api.gpx;
import static org.assertj.core.api.Assertions.*;
import java.io.IOException;
import org.junit.jupiter.api.Test;
class GpxParserTest {
    private final GpxParser parser=new GpxParser();
    @Test void parsesTrackAndMetrics() throws IOException {GpxTrack track=parser.parse(fixture("valid.gpx"));assertThat(track.points()).hasSize(3);assertThat(track.distanceMeters()).isBetween(1000.0,2000.0);assertThat(track.elevationGainMeters()).isEqualTo(15.0);}
    @Test void rejectsMalformedXml(){assertThatThrownBy(()->parser.parse("<gpx><trk>".getBytes())).isInstanceOf(InvalidGpxException.class);}
    @Test void rejectsTrackWithoutPoints() throws IOException {assertThatThrownBy(()->parser.parse(fixture("no-points.gpx"))).isInstanceOf(InvalidGpxException.class).hasMessageContaining("two track points");}
    @Test void calculatesKnownDistance(){double distance=GpxParser.haversineMeters(new GpxPoint(0,0,null),new GpxPoint(0,1,null));assertThat(distance).isBetween(111_000.0,111_300.0);}
    @Test void rejectsExternalEntity(){String xml="<?xml version=\"1.0\"?><!DOCTYPE gpx [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]><gpx><trk><trkseg><trkpt lat=\"1\" lon=\"1\"/><trkpt lat=\"2\" lon=\"2\"/></trkseg></trk></gpx>";assertThatThrownBy(()->parser.parse(xml.getBytes())).isInstanceOf(InvalidGpxException.class);}
    private byte[] fixture(String name) throws IOException{return getClass().getResourceAsStream("/gpx/"+name).readAllBytes();}
}
