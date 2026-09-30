package pl.routecommunity.api.gpx;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.stereotype.Component;
@Component public class GpxWriter {
 public byte[] write(String name,List<List<Double>> coordinates){StringBuilder value=new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<gpx version=\"1.1\" creator=\"Route Community\" xmlns=\"http://www.topografix.com/GPX/1/1\"><trk><name>").append(escape(name)).append("</name><trkseg>");for(var c:coordinates)value.append("<trkpt lat=\"").append(c.get(1)).append("\" lon=\"").append(c.get(0)).append("\"/>");value.append("</trkseg></trk></gpx>");return value.toString().getBytes(StandardCharsets.UTF_8);}
 private String escape(String value){return value.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;");}
}
