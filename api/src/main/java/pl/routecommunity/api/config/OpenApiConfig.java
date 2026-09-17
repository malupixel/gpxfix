package pl.routecommunity.api.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    OpenAPI routeCommunityOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Route Community API")
                .version("v1")
                .description("API for community GPX route sharing and review."));
    }
}
