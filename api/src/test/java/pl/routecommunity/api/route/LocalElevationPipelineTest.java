package pl.routecommunity.api.route;

import static org.assertj.core.api.Assertions.*;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import pl.routecommunity.api.elevation.RouteElevationEnricher;
import pl.routecommunity.api.elevation.dem.DemElevationProvider;
import pl.routecommunity.api.gpx.*;

class LocalElevationPipelineTest {
    @TempDir Path directory;

    @Test void localProviderProducesPersistableVersionGpxWithProfileAndLicence() throws Exception {
        try(var file=new RandomAccessFile(directory.resolve("N52E021.hgt").toFile(),"rw")){file.setLength(3601L*3601*2);}
        var source=GpxParser.calculateMetrics(List.of(List.of(new GpxPoint(52.2,21.2,null),new GpxPoint(52.3,21.3,null))));
        new ApplicationContextRunner().withUserConfiguration(DemElevationProvider.class,RouteElevationEnricher.class,RouteVersionPipeline.class,GpxWriter.class)
                .withPropertyValues("app.elevation.data-path="+directory).run(context->{
                    var prepared=context.getBean(RouteVersionPipeline.class).prepare("Drawn route",source,null);
                    assertThat(source.points()).hasSize(2).extracting(GpxPoint::elevationMeters).containsOnlyNulls();
                    var exported=new GpxParser().parse(prepared.gpx());
                    assertThat(exported.points()).hasSizeGreaterThan(100).extracting(GpxPoint::elevationMeters).containsOnly(0.0);
                    assertThat(new String(prepared.gpx(),StandardCharsets.UTF_8)).contains("<metadata>","Copernicus WorldDEM-30","<ele>0.0</ele>");
                });
    }
}
