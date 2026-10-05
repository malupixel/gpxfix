package pl.routecommunity.api.elevation;

import static org.assertj.core.api.Assertions.*;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.web.client.RestClient;
import pl.routecommunity.api.elevation.dem.DemElevationProvider;

class ElevationProviderConfigurationTest {
    @TempDir Path directory;
    private ApplicationContextRunner context(){return new ApplicationContextRunner()
            .withUserConfiguration(DemElevationProvider.class,OpenMeteoElevationProvider.class,RouteElevationEnricher.class)
            .withBean(RestClient.Builder.class,RestClient::builder)
            .withPropertyValues("app.elevation.data-path="+directory,"app.elevation.base-url=https://api.open-meteo.com");}
    @Test void defaultsToLocalDem(){context().run(ctx->assertThat(ctx.getBean(ElevationProvider.class)).isInstanceOf(DemElevationProvider.class));}
    @Test void remoteIsExplicitAndDoesNotRequireDemDirectory(){context().withPropertyValues("app.elevation.provider=remote","app.elevation.data-path=/does/not/exist")
            .run(ctx->assertThat(ctx.getBean(ElevationProvider.class)).isInstanceOf(OpenMeteoElevationProvider.class));}
    @Test void unknownProviderFailsStartup(){context().withPropertyValues("app.elevation.provider=unknown").run(ctx->assertThat(ctx).hasFailed());}
    @Test void invalidSamplingFailsStartup(){context().withPropertyValues("app.elevation.sample-interval-meters=0").run(ctx->assertThat(ctx).hasFailed());}
}
