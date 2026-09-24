package pl.routecommunity.api;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.nio.file.Files;
import java.nio.file.Path;
import jakarta.servlet.http.Cookie;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    @Autowired MockMvc mvc; @Autowired JdbcTemplate jdbc; @Autowired ObjectMapper json;
    @Test void uploadThenGetRoute() throws Exception {
        byte[] bytes=new ClassPathResource("gpx/valid.gpx").getInputStream().readAllBytes();
        MockMultipartFile file=new MockMultipartFile("file","sample.gpx","application/gpx+xml",bytes);
        var upload=mvc.perform(multipart("/api/routes").file(file).param("name","Warsaw ride").param("description","A sample route"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.publicId").isString()).andExpect(jsonPath("$.managementToken").isString()).andReturn();
        JsonNode created=json.readTree(upload.getResponse().getContentAsString());
        String publicId=created.get("publicId").asText(); String token=created.get("managementToken").asText();
        assertThat(token).hasSizeGreaterThanOrEqualTo(40);
        assertThat(upload.getResponse().getCookie("route_owner")).isNotNull();
        mvc.perform(get("/api/routes/{id}",publicId)).andExpect(status().isOk()).andExpect(jsonPath("$.publicId").value(publicId))
                .andExpect(jsonPath("$.geometry.type").value("LineString")).andExpect(jsonPath("$.geometry.coordinates[0][0]").value(21.0122))
                .andExpect(jsonPath("$.elevationGainMeters").value(15.0))
                .andExpect(jsonPath("$.elevationProfile.length()").value(3))
                .andExpect(jsonPath("$.elevationProfile[0].distanceMeters").value(0.0))
                .andExpect(jsonPath("$.elevationProfile[0].elevationMeters").value(100.0))
                .andExpect(jsonPath("$.elevationProfile[1].distanceMeters").isNumber())
                .andExpect(jsonPath("$.originalFilename").value("sample.gpx"))
                .andExpect(jsonPath("$.managementToken").doesNotExist()).andExpect(jsonPath("$.ownerTokenHash").doesNotExist());
        assertThat(jdbc.queryForObject("select ST_SRID(track_geometry) from routes where public_id=?",Integer.class,publicId)).isEqualTo(4326);
        byte[] storedHash=jdbc.queryForObject("select owner_token_hash from routes where public_id=?",byte[].class,publicId);
        assertThat(storedHash).hasSize(32).isNotEqualTo(token.getBytes());
        assertThat(jdbc.queryForObject("select count(*) from routes where encode(owner_token_hash,'escape')=?",Integer.class,token)).isZero();
        assertThat(Files.list(STORAGE).count()).isPositive();
    }
    @Test void managementTokenCreatesRouteScopedOwnerSession() throws Exception {
        JsonNode first=upload("first.gpx"); JsonNode second=upload("second.gpx");
        assertThat(first.get("managementToken").asText()).isNotEqualTo(second.get("managementToken").asText());
        String firstId=first.get("publicId").asText(); String secondId=second.get("publicId").asText();

        mvc.perform(get("/api/routes/{id}/owner",firstId)).andExpect(status().isForbidden());
        mvc.perform(post("/api/routes/{id}/ownership",firstId).contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"wrong\"}"))
                .andExpect(status().isUnauthorized());
        var authorized=mvc.perform(post("/api/routes/{id}/ownership",firstId).contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\""+first.get("managementToken").asText()+"\"}"))
                .andExpect(status().isNoContent()).andReturn();
        Cookie cookie=authorized.getResponse().getCookie("route_owner");
        assertThat(cookie).isNotNull(); assertThat(cookie.isHttpOnly()).isTrue();
        mvc.perform(get("/api/routes/{id}/owner",firstId).cookie(cookie)).andExpect(status().isOk()).andExpect(jsonPath("$.owner").value(true));
        mvc.perform(get("/api/routes/{id}/owner/access-token",firstId)).andExpect(status().isForbidden());
        var access=mvc.perform(get("/api/routes/{id}/owner/access-token",firstId).cookie(cookie))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control",org.hamcrest.Matchers.containsString("no-store")))
                .andExpect(jsonPath("$.token").isString()).andReturn();
        String accessToken=json.readTree(access.getResponse().getContentAsString()).get("token").asText();
        mvc.perform(post("/api/routes/{id}/ownership",firstId).contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\""+accessToken+"\"}"))
                .andExpect(status().isNoContent()).andExpect(cookie().exists("route_owner"));
        mvc.perform(get("/api/routes/{id}/owner",secondId).cookie(cookie)).andExpect(status().isForbidden());
        mvc.perform(get("/api/routes/{id}",secondId)).andExpect(status().isOk());
    }
    @Test void unknownRouteIs404() throws Exception {mvc.perform(get("/api/routes/doesNotExist")).andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("Route not found"));}
    @Test void malformedUploadIsRejected() throws Exception {MockMultipartFile file=new MockMultipartFile("file","bad.gpx",MediaType.APPLICATION_XML_VALUE,"<not-gpx".getBytes());mvc.perform(multipart("/api/routes").file(file)).andExpect(status().isUnprocessableEntity());}
    @Test void createsAndRetrievesEverySuggestionTypeAsPending() throws Exception {
        String routeId=upload("suggestions.gpx").get("publicId").asText();
        mvc.perform(post("/api/routes/{id}/suggestions",routeId).contentType(MediaType.APPLICATION_JSON).content(noteJson("Spring","REJECTED")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.type").value("NOTE")).andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.publicId").isString()).andExpect(jsonPath("$.start.longitude").value(21.0122));
        mvc.perform(post("/api/routes/{id}/suggestions",routeId).contentType(MediaType.APPLICATION_JSON).content(problemJson()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.type").value("PROBLEM")).andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.end.distanceMeters").value(800.0));
        mvc.perform(post("/api/routes/{id}/suggestions",routeId).contentType(MediaType.APPLICATION_JSON).content(detourJson()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.type").value("DETOUR")).andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.proposedGeometry.type").value("LineString")).andExpect(jsonPath("$.proposedGeometry.coordinates.length()").value(3));
        mvc.perform(get("/api/routes/{id}/suggestions",routeId)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3));
    }
    @Test void suggestionValidationRejectsUnknownRoutesMalformedRequestsAndInvalidGeometry() throws Exception {
        String routeId=upload("validation.gpx").get("publicId").asText();
        mvc.perform(post("/api/routes/missing/suggestions").contentType(MediaType.APPLICATION_JSON).content(noteJson("Water",null))).andExpect(status().isNotFound());
        mvc.perform(post("/api/routes/{id}/suggestions",routeId).contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("Malformed JSON request"));
        mvc.perform(post("/api/routes/{id}/suggestions",routeId).contentType(MediaType.APPLICATION_JSON).content(noteJsonWithCoordinates(200,52.2297)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").exists());
        String detached=detourJson().replace("[21.0122,52.2297]","[21.5,52.5]");
        mvc.perform(post("/api/routes/{id}/suggestions",routeId).contentType(MediaType.APPLICATION_JSON).content(detached))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("Detour geometry must start and end at its route anchors"));
    }
    @Test void suggestionsAreScopedToTheirRoute() throws Exception {
        String first=upload("scope-first.gpx").get("publicId").asText(); String second=upload("scope-second.gpx").get("publicId").asText();
        mvc.perform(post("/api/routes/{id}/suggestions",first).contentType(MediaType.APPLICATION_JSON).content(noteJson("View",null))).andExpect(status().isCreated());
        mvc.perform(get("/api/routes/{id}/suggestions",first)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/routes/{id}/suggestions",second)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }
    private JsonNode upload(String filename) throws Exception {
        byte[] bytes=new ClassPathResource("gpx/valid.gpx").getInputStream().readAllBytes();
        MockMultipartFile file=new MockMultipartFile("file",filename,"application/gpx+xml",bytes);
        return json.readTree(mvc.perform(multipart("/api/routes").file(file)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }
    private String noteJson(String description,String attemptedStatus){return """
            {"type":"NOTE","authorName":"Kasia","description":"%s","category":"water","tags":[],
             "start":{"longitude":21.0122,"latitude":52.2297,"distanceMeters":0},"end":null,"proposedGeometry":null%s}
            """.formatted(description,attemptedStatus==null?"":",\"status\":\""+attemptedStatus+"\"");}
    private String noteJsonWithCoordinates(double longitude,double latitude){return """
            {"type":"NOTE","authorName":"Kasia","description":"Water","category":"water","tags":[],
             "start":{"longitude":%s,"latitude":%s,"distanceMeters":0},"end":null,"proposedGeometry":null}
            """.formatted(longitude,latitude);}
    private String problemJson(){return """
            {"type":"PROBLEM","authorName":"Adam","description":"Heavy traffic","category":"highTraffic","tags":[],
             "start":{"longitude":21.0122,"latitude":52.2297,"distanceMeters":0},
             "end":{"longitude":21.0200,"latitude":52.2350,"distanceMeters":800},"proposedGeometry":null}
            """;}
    private String detourJson(){return """
            {"type":"DETOUR","authorName":"Marek","description":"Safer road","category":null,"tags":["safer"],
             "start":{"longitude":21.0122,"latitude":52.2297,"distanceMeters":0},
             "end":{"longitude":21.0200,"latitude":52.2350,"distanceMeters":800},
             "proposedGeometry":{"type":"LineString","coordinates":[[21.0122,52.2297],[21.016,52.231],[21.0200,52.2350]]}}
            """;}
}
