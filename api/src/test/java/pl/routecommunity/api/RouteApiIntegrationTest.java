package pl.routecommunity.api;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
@Testcontainers(disabledWithoutDocker=true) @SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class RouteApiIntegrationTest {
    private static final Path STORAGE;
    static {try{STORAGE=Files.createTempDirectory("route-community-test-");}catch(Exception e){throw new ExceptionInInitializerError(e);}}
    @Container static final PostgreSQLContainer<?> POSTGRES=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r){r.add("spring.datasource.url",POSTGRES::getJdbcUrl);r.add("spring.datasource.username",POSTGRES::getUsername);r.add("spring.datasource.password",POSTGRES::getPassword);r.add("app.storage.gpx-path",STORAGE::toString);}
    @Autowired MockMvc mvc; @Autowired JdbcTemplate jdbc;
    @Test void uploadThenGetRoute() throws Exception {
        byte[] bytes=new ClassPathResource("gpx/valid.gpx").getInputStream().readAllBytes();
        MockMultipartFile file=new MockMultipartFile("file","sample.gpx","application/gpx+xml",bytes);
        String body=mvc.perform(multipart("/api/routes").file(file).param("name","Warsaw ride").param("description","A sample route"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.publicId").isString()).andReturn().getResponse().getContentAsString();
        String publicId=body.replaceAll(".*\\\"publicId\\\":\\\"([^\\\"]+)\\\".*","$1");
        mvc.perform(get("/api/routes/{id}",publicId)).andExpect(status().isOk()).andExpect(jsonPath("$.publicId").value(publicId))
                .andExpect(jsonPath("$.geometry.type").value("LineString")).andExpect(jsonPath("$.geometry.coordinates[0][0]").value(21.0122))
                .andExpect(jsonPath("$.elevationGainMeters").value(15.0));
        assertThat(jdbc.queryForObject("select ST_SRID(track_geometry) from routes where public_id=?",Integer.class,publicId)).isEqualTo(4326);
        assertThat(Files.list(STORAGE).count()).isPositive();
    }
    @Test void unknownRouteIs404() throws Exception {mvc.perform(get("/api/routes/doesNotExist")).andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("Route not found"));}
    @Test void malformedUploadIsRejected() throws Exception {MockMultipartFile file=new MockMultipartFile("file","bad.gpx",MediaType.APPLICATION_XML_VALUE,"<not-gpx".getBytes());mvc.perform(multipart("/api/routes").file(file)).andExpect(status().isUnprocessableEntity());}
}
