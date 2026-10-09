package pl.routecommunity.api.route;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;

import java.nio.file.*;
import java.util.List;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;
import pl.routecommunity.api.elevation.ElevationProvider;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = "app.preview.poll-delay-ms=3600000")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RouteShareIntegrationTest {
    static final Path STORAGE;
    static { try { STORAGE = Files.createTempDirectory("tmr-share-test-"); } catch (Exception e) { throw new ExceptionInInitializerError(e); } }
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",POSTGRES::getJdbcUrl);r.add("spring.datasource.username",POSTGRES::getUsername);r.add("spring.datasource.password",POSTGRES::getPassword);r.add("app.storage.gpx-path",STORAGE::toString);
    }
    @Autowired MockMvc mvc; @Autowired JdbcTemplate jdbc; @Autowired ObjectMapper json; @Autowired RoutePreviewWorker worker;
    @MockitoBean ElevationProvider heights; @MockitoSpyBean RoutePreviewRenderer renderer;
    byte[] fallback;
    @BeforeEach void setup() throws Exception {
        // Retire only earlier test jobs; each test uses a separate public route.
        jdbc.update("UPDATE routes SET deleted_at=now() WHERE deleted_at IS NULL");
        when(heights.elevations(anyList())).thenAnswer(call -> { List<?> coords=call.getArgument(0); return coords.stream().map(c -> 100.0).toList(); });
        fallback = renderer.fallback();
    }
    record Owned(String id, Cookie owner) { }
    Owned upload() throws Exception {
        var response = mvc.perform(multipart("/api/routes").file(new MockMultipartFile("file","route.gpx","application/gpx+xml",new ClassPathResource("gpx/valid.gpx").getInputStream().readAllBytes())).param("name","Public loop"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        return new Owned(json.readTree(response.getContentAsString()).get("publicId").asText(),response.getCookie("route_owner"));
    }
    JsonNode share(Owned route) throws Exception { return json.readTree(mvc.perform(get("/api/routes/{id}/share",route.id())).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()); }
    @Test void preGeneratesOnceChangesWithVersionAndRenameAndRejectsDeletedRoutes() throws Exception {
        var route=upload();var first=share(route);String firstImage=first.get("imagePath").asText();
        assertThat(first.toString()).doesNotContain("managementToken","owner","storageKey");
        mvc.perform(get(firstImage)).andExpect(status().isOk()).andExpect(content().contentType(MediaType.IMAGE_PNG)).andExpect(header().string("Cache-Control","no-store"));
        worker.generateNext();worker.generateNext();
        String readyFirstImage=share(route).get("imagePath").asText();
        assertThat(readyFirstImage).isEqualTo(firstImage.replace("state=fallback","state=ready"));
        verify(renderer,times(1)).render(anyString(),any(),anyDouble(),nullable(Double.class));
        mvc.perform(get(firstImage)).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-cache"));
        mvc.perform(post("/api/routes/{id}/owner/versions",route.id()).cookie(route.owner()).contentType(MediaType.APPLICATION_JSON).content("""
            {"baseVersionNumber":1,"name":"Public loop","description":"Version two","editorDocument":{"version":1,
            "points":[{"id":"a","coordinate":[21,52]},{"id":"b","coordinate":[21.1,52.1]}],
            "segments":[{"id":"ab","fromId":"a","toId":"b","mode":"DIRECT","geometry":[[21,52],[21.1,52.1]]}]}}
            """)).andExpect(status().isCreated());
        var second=share(route);String secondImage=second.get("imagePath").asText();assertThat(secondImage).isNotEqualTo(firstImage).contains("/versions/2/");
        worker.generateNext();verify(renderer,times(2)).render(anyString(),any(),anyDouble(),nullable(Double.class));
        mvc.perform(get(secondImage)).andExpect(header().string("Cache-Control","no-cache"));
        mvc.perform(get("/api/routes/{id}/versions/1/share",route.id())).andExpect(jsonPath("$.imagePath").value(readyFirstImage));
        String updatedAt=json.readTree(mvc.perform(get("/api/routes/{id}",route.id())).andReturn().getResponse().getContentAsByteArray()).get("updatedAt").asText();
        mvc.perform(patch("/api/routes/{id}/owner/information",route.id()).cookie(route.owner()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(java.util.Map.of("name","Renamed loop","expectedUpdatedAt",updatedAt)))).andExpect(status().isOk());
        String renamedImage=share(route).get("imagePath").asText();assertThat(renamedImage).isNotEqualTo(secondImage);
        mvc.perform(get(secondImage)).andExpect(status().isNotFound());worker.generateNext();
        mvc.perform(delete("/api/routes/{id}/owner",route.id()).cookie(route.owner()).contentType(MediaType.APPLICATION_JSON).content("{\"confirmationName\":\"Renamed loop\"}")).andExpect(status().isNoContent());
        for(String path:List.of(firstImage,secondImage,renamedImage,"/api/routes/"+route.id()+"/share","/api/routes/"+route.id()+"/versions/1/share")) mvc.perform(get(path)).andExpect(status().isNotFound());
    }
    @Test void localFailureKeepsFallbackAndRetriesAreBoundedAndDurable() throws Exception {
        var route=upload();String image=share(route).get("imagePath").asText();
        doThrow(new IllegalStateException("Local rendering failure")).when(renderer).render(anyString(),any(),anyDouble(),nullable(Double.class));
        worker.generateNext();worker.generateNext();verify(renderer,times(1)).render(anyString(),any(),anyDouble(),nullable(Double.class));
        mvc.perform(get(image)).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(content().bytes(fallback));
        for(int i=0;i<4;i++){jdbc.update("UPDATE route_share_previews SET next_attempt_at=now()-interval '1 second' WHERE NOT ready");worker.generateNext();}
        verify(renderer,times(4)).render(anyString(),any(),anyDouble(),nullable(Double.class));
        assertThat(jdbc.queryForObject("SELECT attempts FROM route_share_previews p JOIN route_versions v ON v.id=p.version_id JOIN routes r ON r.id=v.route_id WHERE r.public_id=?",Integer.class,route.id())).isEqualTo(4);
    }
    @Test void noElevationDoesNotBlockMetadataAndMissingRoutesCannotReadImages() throws Exception {
        var route=upload();jdbc.update("UPDATE route_versions SET elevation_gain_meters=null WHERE route_id=(SELECT id FROM routes WHERE public_id=?)",route.id());
        mvc.perform(get("/api/routes/{id}/share",route.id())).andExpect(jsonPath("$.elevationGainMeters").isEmpty());
        worker.generateNext();mvc.perform(get(share(route).get("imagePath").asText())).andExpect(header().string("Cache-Control","no-cache"));
        mvc.perform(get("/api/routes/missing/versions/1/preview/"+"a".repeat(64)+".png")).andExpect(status().isNotFound());

    }
}
