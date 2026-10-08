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
import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import java.util.concurrent.*;
import java.util.List;
import pl.routecommunity.api.elevation.ElevationProvider;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;
@Testcontainers(disabledWithoutDocker=true) @SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class RouteApiIntegrationTest {
    private static final Path STORAGE;
    static {try{STORAGE=Files.createTempDirectory("route-community-test-");}catch(Exception e){throw new ExceptionInInitializerError(e);}}
    @Container static final PostgreSQLContainer<?> POSTGRES=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r){r.add("spring.datasource.url",POSTGRES::getJdbcUrl);r.add("spring.datasource.username",POSTGRES::getUsername);r.add("spring.datasource.password",POSTGRES::getPassword);r.add("app.storage.gpx-path",STORAGE::toString);}
    @Autowired MockMvc mvc; @Autowired JdbcTemplate jdbc; @Autowired ObjectMapper json; @MockitoBean ElevationProvider elevationProvider;
    @BeforeEach void elevation(){when(elevationProvider.elevations(anyList())).thenAnswer(invocation->{List<ElevationProvider.Coordinate> points=invocation.getArgument(0);return points.stream().map(point->100.0+(point.latitude()-52.0)*100).toList();});}
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
        assertThat(jdbc.queryForObject("select ST_SRID(v.track_geometry) from routes r join route_versions v on v.id=r.current_version_id where r.public_id=?",Integer.class,publicId)).isEqualTo(4326);
        assertThat(jdbc.queryForObject("select count(*) from route_versions v join routes r on r.id=v.route_id where r.public_id=? and v.version_number=1",Integer.class,publicId)).isEqualTo(1);
        byte[] storedHash=jdbc.queryForObject("select owner_token_hash from routes where public_id=?",byte[].class,publicId);
        assertThat(storedHash).hasSize(32).isNotEqualTo(token.getBytes());
        assertThat(jdbc.queryForObject("select count(*) from routes where encode(owner_token_hash,'escape')=?",Integer.class,token)).isZero();
        assertThat(Files.list(STORAGE).count()).isPositive();
        verifyNoInteractions(elevationProvider);
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
    @Test void drawnMixedRouteIsPersistedAndExportedAsContinuousGpx() throws Exception {
        String body="""
            {"name":"Mixed route","description":"drawn","editorDocument":{"version":1,
             "points":[{"id":"a","coordinate":[21.0,52.0]},{"id":"b","coordinate":[21.01,52.01]},{"id":"c","coordinate":[21.02,52.01]}],
             "segments":[{"id":"ab","fromId":"a","toId":"b","mode":"ROUTED","geometry":[[21.0,52.0],[21.005,52.006],[21.01,52.01]],"intendedGeometry":[[21.0,52.0],[21.01,52.01]]},
             {"id":"bc","fromId":"b","toId":"c","mode":"DIRECT","geometry":[[21.01,52.01],[21.02,52.01]],"intendedGeometry":[[21.01,52.01],[21.02,52.01]]}]}}
            """;
        var result=mvc.perform(post("/api/routes/drawn").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated()).andExpect(jsonPath("$.managementToken").isString()).andReturn();
        String routeId=json.readTree(result.getResponse().getContentAsString()).get("publicId").asText();
        mvc.perform(get("/api/routes/{id}",routeId)).andExpect(status().isOk()).andExpect(jsonPath("$.geometry.coordinates.length()").value(4)).andExpect(jsonPath("$.geometry.coordinates[3][0]").value(21.02)).andExpect(jsonPath("$.elevationGainMeters").isNumber()).andExpect(jsonPath("$.elevationProfile.length()",org.hamcrest.Matchers.greaterThan(4))).andExpect(jsonPath("$.elevationProfile[0].elevationMeters").isNumber());
        mvc.perform(get("/api/routes/{id}/gpx",routeId)).andExpect(status().isOk()).andExpect(content().contentTypeCompatibleWith("application/gpx+xml")).andExpect(content().string(org.hamcrest.Matchers.containsString("lat=\"52.01\" lon=\"21.02\""))).andExpect(content().string(org.hamcrest.Matchers.containsString("<ele>")));
        verify(elevationProvider,atLeastOnce()).elevations(anyList());
        assertThat(jdbc.queryForObject("select v.source_type from routes r join route_versions v on v.id=r.current_version_id where r.public_id=?",String.class,routeId)).isEqualTo("DRAWN");
        assertThat(jdbc.queryForObject("select v.editor_definition is not null from routes r join route_versions v on v.id=r.current_version_id where r.public_id=?",Boolean.class,routeId)).isTrue();
    }
    @Test void incompleteUploadIsEnrichedWithoutChangingItsGeometry() throws Exception {
        String input=new String(new ClassPathResource("gpx/valid.gpx").getInputStream().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8).replaceAll("<ele>[^<]*</ele>","");
        var uploaded=mvc.perform(multipart("/api/routes").file(new MockMultipartFile("file","missing-ele.gpx","application/gpx+xml",input.getBytes(java.nio.charset.StandardCharsets.UTF_8))))
                .andExpect(status().isCreated()).andReturn();
        String id=json.readTree(uploaded.getResponse().getContentAsString()).get("publicId").asText();
        mvc.perform(get("/api/routes/{id}",id)).andExpect(status().isOk()).andExpect(jsonPath("$.geometry.coordinates.length()").value(3))
                .andExpect(jsonPath("$.elevationProfile.length()",org.hamcrest.Matchers.greaterThan(3)));
        mvc.perform(get("/api/routes/{id}/gpx",id)).andExpect(content().string(org.hamcrest.Matchers.containsString("<ele>")));
        verify(elevationProvider,times(1)).elevations(anyList());
    }
    @Test void longTwoPointDrawnRoutePersistsThousandsOfSamplesButOnlyTwoGeometryPoints() throws Exception {
        String body="""
                {"name":"Long direct route","editorDocument":{"version":1,
                "points":[{"id":"a","coordinate":[21,52]},{"id":"b","coordinate":[21,54.7]}],
                "segments":[{"id":"ab","fromId":"a","toId":"b","mode":"DIRECT","geometry":[[21,52],[21,54.7]]}]}}
                """;
        var created=mvc.perform(post("/api/routes/drawn").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated()).andReturn();
        String id=json.readTree(created.getResponse().getContentAsString()).get("publicId").asText();
        mvc.perform(get("/api/routes/{id}",id)).andExpect(jsonPath("$.geometry.coordinates.length()").value(2))
                .andExpect(jsonPath("$.elevationProfile.length()",org.hamcrest.Matchers.greaterThan(3000)));
        verify(elevationProvider,times(1)).elevations(anyList());
    }
    @Test void elevationFailureDoesNotSaveAPartialRoute() throws Exception {
        int before=jdbc.queryForObject("select count(*) from routes",Integer.class);
        when(elevationProvider.elevations(anyList())).thenThrow(new pl.routecommunity.api.common.error.ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Missing local DEM tile"));
        String input="<gpx><trk><trkseg><trkpt lat=\"52\" lon=\"21\"/><trkpt lat=\"52.01\" lon=\"21.01\"/></trkseg></trk></gpx>";
        mvc.perform(multipart("/api/routes").file(new MockMultipartFile("file","missing.gpx","application/gpx+xml",input.getBytes())))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error").value("Missing local DEM tile"));
        assertThat(jdbc.queryForObject("select count(*) from routes",Integer.class)).isEqualTo(before);
    }
    @Test void createsAndRetrievesEverySuggestionTypeAsPending() throws Exception {
        String routeId=upload("suggestions.gpx").get("publicId").asText();
        mvc.perform(post("/api/routes/{id}/suggestions",routeId).contentType(MediaType.APPLICATION_JSON).content(noteJson("Spring","REJECTED")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.type").value("NOTE")).andExpect(jsonPath("$.moderationStatus").value("PENDING"))
                .andExpect(jsonPath("$.publicId").isString()).andExpect(jsonPath("$.start.longitude").value(21.0122));
        mvc.perform(post("/api/routes/{id}/suggestions",routeId).contentType(MediaType.APPLICATION_JSON).content(problemJson()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.type").value("PROBLEM")).andExpect(jsonPath("$.moderationStatus").value("PENDING"))
                .andExpect(jsonPath("$.end.distanceMeters").value(800.0));
        mvc.perform(post("/api/routes/{id}/suggestions",routeId).contentType(MediaType.APPLICATION_JSON).content(detourJson()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.type").value("DETOUR")).andExpect(jsonPath("$.moderationStatus").value("PENDING"))
                .andExpect(jsonPath("$.integrationStatus").value("NOT_MERGED")).andExpect(jsonPath("$.applicability").value("CLEAN"))
                .andExpect(jsonPath("$.proposedGeometry.type").value("LineString")).andExpect(jsonPath("$.proposedGeometry.coordinates.length()").value(3));
        mvc.perform(get("/api/routes/{id}/suggestions",routeId)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
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
        mvc.perform(get("/api/routes/{id}/suggestions",first)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/routes/{id}/suggestions",second)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }
    @Test void moderationAndDiscussionArePrivateRouteScopedAndDoNotMutateRoute() throws Exception {
        JsonNode first=upload("moderation.gpx"), second=upload("other.gpx");String routeId=first.get("publicId").asText();
        var created=mvc.perform(post("/api/routes/{id}/suggestions",routeId).contentType(MediaType.APPLICATION_JSON).content(noteJson("Spring","PUBLISHED")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.moderationStatus").value("PENDING")).andReturn();
        String suggestionId=json.readTree(created.getResponse().getContentAsString()).get("publicId").asText();
        Double distance=jdbc.queryForObject("select v.distance_meters from routes r join route_versions v on v.id=r.current_version_id where r.public_id=?",Double.class,routeId);
        byte[] geometry=jdbc.queryForObject("select ST_AsBinary(v.track_geometry) from routes r join route_versions v on v.id=r.current_version_id where r.public_id=?",byte[].class,routeId);
        mvc.perform(post("/api/routes/{id}/suggestions/{sid}/comments",routeId,suggestionId).contentType(MediaType.APPLICATION_JSON).content("{\"authorName\":\" Ola \",\"content\":\" hello \"}"))
                .andExpect(status().isConflict());
        Cookie firstOwner=ownerCookie(routeId,first.get("managementToken").asText());Cookie secondOwner=ownerCookie(second.get("publicId").asText(),second.get("managementToken").asText());
        mvc.perform(get("/api/routes/{id}/suggestions/owner",routeId).cookie(firstOwner)).andExpect(status().isOk()).andExpect(jsonPath("$[0].moderationStatus").value("PENDING"));
        mvc.perform(patch("/api/routes/{id}/suggestions/owner/{sid}/moderation",routeId,suggestionId).cookie(secondOwner).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\"PUBLISHED\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/routes/{id}/suggestions/owner/{sid}/moderation",routeId,suggestionId).cookie(firstOwner).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\"PUBLISHED\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.moderationStatus").value("PUBLISHED"));
        mvc.perform(get("/api/routes/{id}/suggestions",routeId)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        var rejected=mvc.perform(post("/api/routes/{id}/suggestions",routeId).contentType(MediaType.APPLICATION_JSON).content(noteJson("Private",null))).andReturn();
        String rejectedId=json.readTree(rejected.getResponse().getContentAsString()).get("publicId").asText();
        mvc.perform(patch("/api/routes/{id}/suggestions/owner/{sid}/moderation",routeId,rejectedId).cookie(firstOwner).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\"REJECTED\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/routes/{id}/suggestions/{sid}",routeId,rejectedId)).andExpect(status().isNotFound());
        mvc.perform(post("/api/routes/{id}/suggestions/{sid}/comments",routeId,rejectedId).contentType(MediaType.APPLICATION_JSON).content("{\"authorName\":\"Ola\",\"content\":\"hidden\"}"))
                .andExpect(status().isConflict());
        var comment=mvc.perform(post("/api/routes/{id}/suggestions/{sid}/comments",routeId,suggestionId).contentType(MediaType.APPLICATION_JSON).content("{\"authorName\":\" Ola \",\"content\":\" hello \" ,\"moderationStatus\":\"PUBLISHED\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.moderationStatus").value("PENDING")).andExpect(jsonPath("$.content").value("hello")).andReturn();
        String commentId=json.readTree(comment.getResponse().getContentAsString()).get("publicId").asText();
        mvc.perform(get("/api/routes/{id}/suggestions/owner",routeId).cookie(firstOwner)).andExpect(jsonPath("$[0].comments[0].moderationStatus").value("PENDING"));
        mvc.perform(get("/api/routes/{id}/suggestions/owner/moderation-queue",routeId).cookie(firstOwner)).andExpect(jsonPath("$[0].kind").value("COMMENT"));
        var rejectedComment=mvc.perform(post("/api/routes/{id}/suggestions/{sid}/comments",routeId,suggestionId).contentType(MediaType.APPLICATION_JSON).content("{\"authorName\":\"Jan\",\"content\":\"reject me\"}" )).andReturn();
        String rejectedCommentId=json.readTree(rejectedComment.getResponse().getContentAsString()).get("publicId").asText();
        mvc.perform(patch("/api/routes/{id}/suggestions/owner/comments/{cid}/moderation",routeId,rejectedCommentId).cookie(firstOwner).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\"REJECTED\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/routes/{id}/suggestions/{sid}",routeId,suggestionId)).andExpect(jsonPath("$.comments.length()").value(0));
        mvc.perform(patch("/api/routes/{id}/suggestions/owner/comments/{cid}/moderation",second.get("publicId").asText(),commentId).cookie(secondOwner).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\"PUBLISHED\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(patch("/api/routes/{id}/suggestions/owner/comments/{cid}/moderation",routeId,commentId).cookie(firstOwner).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\"PUBLISHED\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/routes/{id}/suggestions/{sid}",routeId,suggestionId)).andExpect(jsonPath("$.comments[0].content").value("hello")).andExpect(jsonPath("$.commentCount").value(1));
        assertThat(jdbc.queryForObject("select v.distance_meters from routes r join route_versions v on v.id=r.current_version_id where r.public_id=?",Double.class,routeId)).isEqualTo(distance);
        assertThat(jdbc.queryForObject("select ST_AsBinary(v.track_geometry) from routes r join route_versions v on v.id=r.current_version_id where r.public_id=?",byte[].class,routeId)).isEqualTo(geometry);
    }
    @Test void mergeCreatesImmutableVersionAndKeepsSuggestionHistory() throws Exception {
        JsonNode created=upload("versioned.gpx");String routeId=created.get("publicId").asText();Cookie owner=ownerCookie(routeId,created.get("managementToken").asText());
        String originalGpx=mvc.perform(get("/api/routes/{id}/gpx",routeId)).andReturn().getResponse().getContentAsString();
        String suggestionId=createSuggestion(routeId,detourJson());publish(routeId,suggestionId,owner);
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",routeId,suggestionId)).andExpect(status().isForbidden());
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",routeId,suggestionId).cookie(owner)).andExpect(status().isOk())
                .andExpect(jsonPath("$.currentVersion").value(2)).andExpect(jsonPath("$.viewedVersion").value(2)).andExpect(jsonPath("$.isCurrentVersion").value(true))
                .andExpect(jsonPath("$.elevationProfile.length()",org.hamcrest.Matchers.greaterThan(3)));
        mvc.perform(get("/api/routes/{id}/versions/1",routeId)).andExpect(status().isOk()).andExpect(jsonPath("$.viewedVersion").value(1))
                .andExpect(jsonPath("$.isCurrentVersion").value(false)).andExpect(jsonPath("$.geometry.coordinates[1][0]").value(21.02))
                .andExpect(jsonPath("$.elevationProfile.length()").value(3)).andExpect(jsonPath("$.elevationProfile[0].elevationMeters").value(100.0));
        mvc.perform(get("/api/routes/{id}/versions/1/gpx",routeId)).andExpect(status().isOk()).andExpect(content().string(originalGpx));
        mvc.perform(get("/api/routes/{id}",routeId)).andExpect(jsonPath("$.geometry.coordinates[1][0]").value(21.016));
        mvc.perform(get("/api/routes/{id}/versions",routeId)).andExpect(status().isOk()).andExpect(jsonPath("$[0].versionNumber").value(2))
                .andExpect(jsonPath("$[0].source").value("SUGGESTION_MERGE")).andExpect(jsonPath("$[0].mergedSuggestionPublicId").value(suggestionId));
        mvc.perform(get("/api/routes/{id}/suggestions/owner",routeId).cookie(owner)).andExpect(jsonPath("$[0].integrationStatus").value("MERGED"))
                .andExpect(jsonPath("$[0].baseVersionNumber").value(1)).andExpect(jsonPath("$[0].mergedIntoVersionNumber").value(2));
        assertThat(jdbc.queryForObject("select count(*) from route_versions v join routes r on r.id=v.route_id where r.public_id=?",Integer.class,routeId)).isEqualTo(2);
    }
    @Test void staleOverlappingSuggestionConflictsWithoutChangingCurrentVersion() throws Exception {
        JsonNode created=upload("conflict.gpx");String routeId=created.get("publicId").asText();Cookie owner=ownerCookie(routeId,created.get("managementToken").asText());
        String first=createSuggestion(routeId,detourJson()),second=createSuggestion(routeId,detourJson().replace("21.016,52.231","21.017,52.232"));publish(routeId,first,owner);publish(routeId,second,owner);
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",routeId,first).cookie(owner)).andExpect(status().isOk());
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",routeId,second).cookie(owner)).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("created on v1")));
        mvc.perform(get("/api/routes/{id}",routeId)).andExpect(jsonPath("$.currentVersion").value(2));
        mvc.perform(get("/api/routes/{id}/suggestions",routeId).param("versionNumber","1")).andExpect(jsonPath("$[?(@.publicId == '"+second+"')].integrationStatus").value(org.hamcrest.Matchers.contains("NOT_MERGED")))
                .andExpect(jsonPath("$[?(@.publicId == '"+second+"')].baseVersionNumber").value(org.hamcrest.Matchers.contains(1)));
    }
    @Test void informationalSuggestionsDoNotCreateEmptyRouteVersions() throws Exception {
        JsonNode created=upload("informational.gpx");String routeId=created.get("publicId").asText();Cookie owner=ownerCookie(routeId,created.get("managementToken").asText());String note=createSuggestion(routeId,noteJson("Water",null));publish(routeId,note,owner);
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",routeId,note).cookie(owner)).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("does not create")));
        mvc.perform(get("/api/routes/{id}",routeId)).andExpect(jsonPath("$.currentVersion").value(1));
    }
    @Test void independentStaleSuggestionsMergeSeriallyIntoUniqueVersions() throws Exception {
        JsonNode created=upload("independent.gpx");String routeId=created.get("publicId").asText();Cookie owner=ownerCookie(routeId,created.get("managementToken").asText());
        String first=createSuggestion(routeId,detourJson());
        String second=createSuggestion(routeId,detourJson(21.0200,52.2350,793.4030900609766,21.0300,52.2400,1672.4923119104333,21.025,52.238));
        publish(routeId,first,owner);publish(routeId,second,owner);
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",routeId,first).cookie(owner)).andExpect(status().isOk()).andExpect(jsonPath("$.currentVersion").value(2));
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",routeId,second).cookie(owner)).andExpect(status().isOk()).andExpect(jsonPath("$.currentVersion").value(3));
        assertThat(jdbc.queryForList("select v.version_number from route_versions v join routes r on r.id=v.route_id where r.public_id=? order by v.version_number",Integer.class,routeId)).containsExactly(1,2,3);
        mvc.perform(get("/api/routes/{id}/versions/1",routeId)).andExpect(jsonPath("$.geometry.coordinates.length()").value(3));
    }
    @Test void twoConcurrentIndependentMergesAreSerialized() throws Exception {
        JsonNode created=upload("concurrent.gpx");String routeId=created.get("publicId").asText();Cookie owner=ownerCookie(routeId,created.get("managementToken").asText());
        String first=createSuggestion(routeId,detourJson()),second=createSuggestion(routeId,detourJson(21.0200,52.2350,793.4030900609766,21.0300,52.2400,1672.4923119104333,21.025,52.238));publish(routeId,first,owner);publish(routeId,second,owner);
        try(ExecutorService executor=Executors.newFixedThreadPool(2)){Callable<Integer> mergeFirst=()->mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",routeId,first).cookie(owner)).andReturn().getResponse().getStatus();Callable<Integer> mergeSecond=()->mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",routeId,second).cookie(owner)).andReturn().getResponse().getStatus();Future<Integer> a=executor.submit(mergeFirst),b=executor.submit(mergeSecond);assertThat(List.of(a.get(),b.get())).containsOnly(200);}
        assertThat(jdbc.queryForList("select v.version_number from route_versions v join routes r on r.id=v.route_id where r.public_id=? order by v.version_number",Integer.class,routeId)).containsExactly(1,2,3);
    }
    private String createSuggestion(String routeId,String body)throws Exception{return json.readTree(mvc.perform(post("/api/routes/{id}/suggestions",routeId).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("publicId").asText();}
    @Test void publishedSuggestionsCanBeUnpublishedRepublishedOrRejectedWithoutLosingDiscussion() throws Exception {
        JsonNode route=upload("lifecycle.gpx");String routeId=route.get("publicId").asText();Cookie owner=ownerCookie(routeId,route.get("managementToken").asText());
        String sid=createSuggestion(routeId,detourJson());publish(routeId,sid,owner);
        String commentId=json.readTree(mvc.perform(post("/api/routes/{id}/suggestions/{sid}/comments",routeId,sid)
                .contentType(MediaType.APPLICATION_JSON).content("{\"authorName\":\"Rider\",\"content\":\"Keep this discussion\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsByteArray()).get("publicId").asText();
        String path="/api/routes/{id}/suggestions/owner/{sid}/moderation";
        mvc.perform(patch(path,routeId,sid).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\"PENDING\"}")).andExpect(status().isForbidden());
        mvc.perform(patch(path,routeId,sid).cookie(owner).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\"PENDING\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.comments[0].publicId").value(commentId)).andExpect(jsonPath("$.baseVersionNumber").value(1));
        mvc.perform(get("/api/routes/{id}/suggestions",routeId)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/routes/{id}/suggestions/{sid}",routeId,sid)).andExpect(status().isNotFound());
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",routeId,sid).cookie(owner)).andExpect(status().isConflict());
        publish(routeId,sid,owner);
        mvc.perform(get("/api/routes/{id}/suggestions/owner",routeId).cookie(owner)).andExpect(jsonPath("$[0].comments[0].publicId").value(commentId));
        mvc.perform(patch(path,routeId,sid).cookie(owner).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\"REJECTED\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.moderationStatus").value("REJECTED"));
        mvc.perform(patch(path,routeId,sid).cookie(owner).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\"PUBLISHED\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",routeId,sid).cookie(owner)).andExpect(status().isConflict());
        mvc.perform(get("/api/routes/{id}/suggestions",routeId)).andExpect(jsonPath("$.length()").value(0));
        assertThat(jdbc.queryForObject("select count(*) from suggestion_comments where public_id=?",Integer.class,commentId)).isEqualTo(1);
    }

    @Test void ownerEditCreatesVersionSevenAndRecalculatesGeometryProfileAndExportWithoutChangingHistory() throws Exception {
        JsonNode created=upload("owner-edit.gpx");String routeId=created.get("publicId").asText();Cookie owner=ownerCookie(routeId,created.get("managementToken").asText());
        JsonNode other=upload("wrong-owner.gpx");Cookie wrongOwner=ownerCookie(other.get("publicId").asText(),other.get("managementToken").asText());
        String path="/api/routes/{id}/owner/versions";
        mvc.perform(get("/api/routes/{id}/owner/editor",routeId)).andExpect(status().isForbidden());
        mvc.perform(get("/api/routes/{id}/owner/editor",routeId).cookie(wrongOwner)).andExpect(status().isForbidden());
        mvc.perform(post(path,routeId).contentType(MediaType.APPLICATION_JSON).content(editJson(1,21.03))).andExpect(status().isForbidden());
        mvc.perform(post(path,routeId).cookie(wrongOwner).contentType(MediaType.APPLICATION_JSON).content(editJson(1,21.03))).andExpect(status().isForbidden());
        for(int version=1;version<6;version++)mvc.perform(post(path,routeId).cookie(owner).contentType(MediaType.APPLICATION_JSON).content(editJson(version,21.03)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.currentVersion").value(version+1));
        String sid=createSuggestion(routeId,noteJsonWithCoordinates(21.0122,52.2299));publish(routeId,sid,owner);
        byte[] originalGpx=mvc.perform(get("/api/routes/{id}/versions/6/gpx",routeId)).andReturn().getResponse().getContentAsByteArray();
        var original=jdbc.queryForMap("select v.storage_key,v.distance_meters,v.elevation_gain_meters,ST_AsText(v.track_geometry) as geometry from route_versions v join routes r on r.id=v.route_id where r.public_id=? and v.version_number=6",routeId);
        mvc.perform(get("/api/routes/{id}/owner/editor",routeId).cookie(owner)).andExpect(status().isOk())
                .andExpect(jsonPath("$.route.viewedVersion").value(6)).andExpect(jsonPath("$.editorDocument.points.length()").value(2));
        var result=mvc.perform(post(path,routeId).cookie(owner).contentType(MediaType.APPLICATION_JSON).content(editJson(6,21.05)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.currentVersion").value(7)).andExpect(jsonPath("$.geometry.coordinates[1][0]").value(21.05))
                .andExpect(jsonPath("$.elevationProfile.length()",org.hamcrest.Matchers.greaterThan(2))).andReturn();
        JsonNode next=json.readTree(result.getResponse().getContentAsByteArray());
        assertThat(next.get("distanceMeters").asDouble()).isGreaterThan(((Number)original.get("distance_meters")).doubleValue());
        assertThat(next.get("elevationProfile").get(0).get("elevationMeters").asDouble()).isCloseTo(122.99,org.assertj.core.data.Offset.offset(1e-8));
        assertThat(jdbc.queryForMap("select v.storage_key,v.distance_meters,v.elevation_gain_meters,ST_AsText(v.track_geometry) as geometry from route_versions v join routes r on r.id=v.route_id where r.public_id=? and v.version_number=6",routeId)).isEqualTo(original);
        mvc.perform(get("/api/routes/{id}/versions/6/gpx",routeId)).andExpect(content().bytes(originalGpx));
        mvc.perform(get("/api/routes/{id}/gpx",routeId)).andExpect(content().string(org.hamcrest.Matchers.containsString("lon=\"21.05\"")));
        mvc.perform(get("/api/routes/{id}/versions",routeId)).andExpect(jsonPath("$[0].source").value("OWNER_EDIT")).andExpect(jsonPath("$[0].basedOnVersionNumber").value(6));
        mvc.perform(get("/api/routes/{id}/suggestions",routeId)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/routes/{id}/suggestions",routeId).param("versionNumber","6")).andExpect(jsonPath("$[0].baseVersionNumber").value(6));
        mvc.perform(get("/api/routes/{id}/suggestions/owner",routeId).cookie(owner)).andExpect(jsonPath("$[0].baseVersionNumber").value(6)).andExpect(jsonPath("$[0].moderationStatus").value("PUBLISHED"));
        mvc.perform(post(path,routeId).cookie(owner).contentType(MediaType.APPLICATION_JSON).content(editJson(6,21.09))).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("select count(*) from route_versions v join routes r on r.id=v.route_id where r.public_id=?",Integer.class,routeId)).isEqualTo(7);
    }

    @Test void simultaneousOwnerEditsWithTheSameBaseAllowOnlyOneNewVersion() throws Exception {
        JsonNode created=upload("racing-edits.gpx");String routeId=created.get("publicId").asText();Cookie owner=ownerCookie(routeId,created.get("managementToken").asText());
        try(ExecutorService executor=Executors.newFixedThreadPool(2)){
            Callable<Integer> save=()->mvc.perform(post("/api/routes/{id}/owner/versions",routeId).cookie(owner).contentType(MediaType.APPLICATION_JSON).content(editJson(1,21.05))).andReturn().getResponse().getStatus();
            Future<Integer> a=executor.submit(save),b=executor.submit(save);assertThat(List.of(a.get(),b.get())).containsExactlyInAnyOrder(201,409);
        }
        mvc.perform(get("/api/routes/{id}",routeId)).andExpect(jsonPath("$.currentVersion").value(2));
    }

    @Test void mergedSuggestionIsTerminalAndIsNotAnActiveOverlay() throws Exception {
        JsonNode created=upload("terminal-merge.gpx");String routeId=created.get("publicId").asText();Cookie owner=ownerCookie(routeId,created.get("managementToken").asText());
        String sid=createSuggestion(routeId,detourJson());publish(routeId,sid,owner);
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",routeId,sid).cookie(owner)).andExpect(status().isOk());
        for(String target:List.of("PENDING","PUBLISHED","REJECTED"))mvc.perform(patch("/api/routes/{id}/suggestions/owner/{sid}/moderation",routeId,sid).cookie(owner).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\""+target+"\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",routeId,sid).cookie(owner)).andExpect(status().isConflict());
        mvc.perform(get("/api/routes/{id}/suggestions",routeId).param("versionNumber","1")).andExpect(jsonPath("$.length()").value(0));
    }

    @Test void mergeInvalidatesAnOpenOwnerEditorAndOwnerEditInvalidatesChangedSuggestionSections() throws Exception {
        JsonNode created=upload("merge-edit-conflict.gpx");String routeId=created.get("publicId").asText();Cookie owner=ownerCookie(routeId,created.get("managementToken").asText());
        String first=createSuggestion(routeId,detourJson());publish(routeId,first,owner);
        mvc.perform(get("/api/routes/{id}/owner/editor",routeId).cookie(owner)).andExpect(jsonPath("$.route.viewedVersion").value(1));
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",routeId,first).cookie(owner)).andExpect(status().isOk());
        mvc.perform(post("/api/routes/{id}/owner/versions",routeId).cookie(owner).contentType(MediaType.APPLICATION_JSON).content(editJson(1,21.05))).andExpect(status().isConflict());
        String second=createSuggestion(routeId,detourJson());publish(routeId,second,owner);
        mvc.perform(post("/api/routes/{id}/owner/versions",routeId).cookie(owner).contentType(MediaType.APPLICATION_JSON).content(editJson(2,21.05))).andExpect(status().isCreated());
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",routeId,second).cookie(owner)).andExpect(status().isConflict());
        mvc.perform(get("/api/routes/{id}/suggestions/owner",routeId).cookie(owner)).andExpect(jsonPath("$[1].baseVersionNumber").value(2)).andExpect(jsonPath("$[1].moderationStatus").value("PUBLISHED"));
        mvc.perform(get("/api/routes/{id}",routeId)).andExpect(jsonPath("$.currentVersion").value(3));
    }

    @Test void readingLegacyVersionElevationDoesNotMutateItsRowOrStoredGpx() throws Exception {
        JsonNode created=upload("legacy-elevation.gpx");String routeId=created.get("publicId").asText();Cookie owner=ownerCookie(routeId,created.get("managementToken").asText());
        String key=jdbc.queryForObject("select v.storage_key from route_versions v join routes r on r.id=v.route_id where r.public_id=?",String.class,routeId);
        Path file=STORAGE.resolve(key);String raw=Files.readString(file).replaceAll("<ele>[^<]*</ele>","");Files.writeString(file,raw);
        var row=jdbc.queryForMap("select v.* from route_versions v join routes r on r.id=v.route_id where r.public_id=?",routeId);
        mvc.perform(post("/api/routes/{id}/owner/versions",routeId).cookie(owner).contentType(MediaType.APPLICATION_JSON).content(editJson(1,21.05))).andExpect(status().isCreated());
        mvc.perform(get("/api/routes/{id}/versions/1",routeId)).andExpect(status().isOk()).andExpect(jsonPath("$.elevationProfile[0].elevationMeters").isNumber());
        clearInvocations(elevationProvider);
        mvc.perform(get("/api/routes/{id}/versions/1/gpx",routeId)).andExpect(status().isOk())
                .andExpect(header().string("X-Elevation-Available","false"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("<ele>"))));
        verifyNoInteractions(elevationProvider);
        assertThat(jdbc.queryForMap("select v.* from route_versions v join routes r on r.id=v.route_id where r.public_id=? and v.version_number=1",routeId)).isEqualTo(row);
        assertThat(Files.readString(file)).isEqualTo(raw);
    }

    private String editJson(int base,double endLongitude){return """
        {"baseVersionNumber":%d,"name":"Owner edit","description":"New geometry","editorDocument":{"version":1,
        "points":[{"id":"a","coordinate":[21.0122,52.2299]},{"id":"b","coordinate":[%s,52.245]}],
        "segments":[{"id":"ab","fromId":"a","toId":"b","mode":"DIRECT","geometry":[[21.0122,52.2299],[%s,52.245]]}]}}
        """.formatted(base,endLongitude,endLongitude);}

    private void publish(String routeId,String suggestionId,Cookie owner)throws Exception{mvc.perform(patch("/api/routes/{id}/suggestions/owner/{sid}/moderation",routeId,suggestionId).cookie(owner).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\"PUBLISHED\"}")).andExpect(status().isOk());}
    private Cookie ownerCookie(String routeId,String token)throws Exception{return mvc.perform(post("/api/routes/{id}/ownership",routeId).contentType(MediaType.APPLICATION_JSON).content("{\"token\":\""+token+"\"}" )).andExpect(status().isNoContent()).andReturn().getResponse().getCookie("route_owner");}
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
    private String detourJson(double startLng,double startLat,double startDistance,double endLng,double endLat,double endDistance,double middleLng,double middleLat){return """
            {"type":"DETOUR","authorName":"Marek","description":"Independent safer road","category":null,"tags":["safer"],
             "start":{"longitude":%s,"latitude":%s,"distanceMeters":%s},
             "end":{"longitude":%s,"latitude":%s,"distanceMeters":%s},
             "proposedGeometry":{"type":"LineString","coordinates":[[%s,%s],[%s,%s],[%s,%s]]}}
            """.formatted(startLng,startLat,startDistance,endLng,endLat,endDistance,startLng,startLat,middleLng,middleLat,endLng,endLat);}
}
