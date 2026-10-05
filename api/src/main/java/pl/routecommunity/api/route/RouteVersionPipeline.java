package pl.routecommunity.api.route;

import org.springframework.stereotype.Component;
import pl.routecommunity.api.elevation.RouteElevationEnricher;
import pl.routecommunity.api.gpx.*;

@Component
class RouteVersionPipeline {
    private final RouteElevationEnricher elevations;private final GpxWriter writer;
    RouteVersionPipeline(RouteElevationEnricher elevations,GpxWriter writer){this.elevations=elevations;this.writer=writer;}
    Prepared prepare(String name,GpxTrack source,byte[] originalGpx){GpxTrack enriched=elevations.enrich(source);byte[] gpx=enriched==source&&originalGpx!=null?originalGpx:writer.write(name,enriched,enriched==source?null:elevations.attribution());return new Prepared(enriched,gpx);}
    record Prepared(GpxTrack track,byte[] gpx){}
}
