package pl.routecommunity.api.gpx;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Component;
@Component public class GpxWriter {
 public byte[] write(String name,GpxTrack track){return write(name,track,null);}
 public byte[] write(String name,GpxTrack track,String attribution){StringBuilder value=new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<gpx version=\"1.1\" creator=\"Route Community\" xmlns=\"http://www.topografix.com/GPX/1/1\">");if(attribution!=null)value.append("<metadata><desc>").append(escape(attribution)).append("</desc></metadata>");value.append("<trk><name>").append(escape(name)).append("</name>");for(var segment:track.segments()){value.append("<trkseg>");for(var point:segment){value.append("<trkpt lat=\"").append(point.latitude()).append("\" lon=\"").append(point.longitude()).append("\">");if(point.elevationMeters()!=null)value.append("<ele>").append(point.elevationMeters()).append("</ele>");value.append("</trkpt>");}value.append("</trkseg>");}value.append("</trk></gpx>");return value.toString().getBytes(StandardCharsets.UTF_8);}
 private String escape(String value){return value.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;");}
}
