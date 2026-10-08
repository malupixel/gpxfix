package pl.routecommunity.api;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
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
import org.springframework.test.web.servlet.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;
import pl.routecommunity.api.elevation.ElevationProvider;
import pl.routecommunity.api.gpx.GpxParser;

@Testcontainers(disabledWithoutDocker=true) @SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class RouteManagementApiIntegrationTest {
    static final Path STORAGE;
    static {try{STORAGE=Files.createTempDirectory("tmr-management-test-");}catch(Exception e){throw new ExceptionInInitializerError(e);}}
    @Container static final PostgreSQLContainer<?> POSTGRES=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r){r.add("spring.datasource.url",POSTGRES::getJdbcUrl);r.add("spring.datasource.username",POSTGRES::getUsername);r.add("spring.datasource.password",POSTGRES::getPassword);r.add("app.storage.gpx-path",STORAGE::toString);}
    @Autowired MockMvc mvc; @Autowired JdbcTemplate jdbc; @Autowired ObjectMapper json;
    @MockitoBean ElevationProvider heights;
    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    @BeforeEach void elevation(){when(heights.elevations(anyList())).thenAnswer(call->{List<?> coordinates=call.getArgument(0);return coordinates.stream().map(c->100.0).toList();});}
    record Owned(String id,Cookie cookie,byte[] original) { }
    Owned upload() throws Exception {
        byte[] original=new ClassPathResource("gpx/valid.gpx").getInputStream().readAllBytes();
        var response=mvc.perform(multipart("/api/routes").file(new MockMultipartFile("file","Oryginał.gpx","application/gpx+xml",original)).param("name","Kwadraty Białołęka"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        return new Owned(json.readTree(response.getContentAsString()).get("publicId").asText(),response.getCookie("route_owner"),original);
    }
    JsonNode read(ResultActions response) throws Exception {return json.readTree(response.andReturn().getResponse().getContentAsString());}
    JsonNode route(Owned route) throws Exception{return read(mvc.perform(get("/api/routes/{id}",route.id())).andExpect(status().isOk()));}
    JsonNode activity(Owned route,boolean owner,int limit,String cursor) throws Exception {
        var request=get("/api/routes/{id}/{scope}activity",route.id(),owner?"owner/":"").param("limit",String.valueOf(limit));
        if(owner)request.cookie(route.cookie());if(cursor!=null)request.param("cursor",cursor);
        return read(mvc.perform(request).andExpect(status().isOk()));
    }
    int count(Owned route){return jdbc.queryForObject("select count(*) from route_activity a join routes r on r.id=a.route_id where r.public_id=?",Integer.class,route.id());}
    String note="""
        {"type":"NOTE","authorName":"Private author","description":"Private text","category":"water","tags":[],"start":{"longitude":21.0122,"latitude":52.2297,"distanceMeters":0}}
        """;
    String suggestion(Owned route,String key) throws Exception{return read(mvc.perform(post("/api/routes/{id}/suggestions",route.id()).header("Idempotency-Key",key).contentType(MediaType.APPLICATION_JSON).content(note)).andExpect(status().isCreated())).get("publicId").asText();}
    void moderate(Owned route,String id,String state) throws Exception {mvc.perform(patch("/api/routes/{id}/suggestions/owner/{sid}/moderation",route.id(),id).cookie(route.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\""+state+"\"}")).andExpect(status().isOk());}

    @Test void activityUsesRealEventsAndHidesCurrentPrivateSubjectsWithStablePagination() throws Exception {
        Owned route=upload();assertThat(count(route)).isEqualTo(1);
        String id=suggestion(route,"suggestion-one");assertThat(suggestion(route,"suggestion-one")).isEqualTo(id);assertThat(count(route)).isEqualTo(2);
        mvc.perform(post("/api/routes/{id}/suggestions",route.id()).header("Idempotency-Key","suggestion-one").contentType(MediaType.APPLICATION_JSON).content(note.replace("Private text","Different"))).andExpect(status().isConflict());
        assertThat(activity(route,false,100,null).get("items").size()).isEqualTo(1);
        assertThat(activity(route,true,100,null).get("items").size()).isEqualTo(2);
        moderate(route,id,"PUBLISHED");moderate(route,id,"PUBLISHED");assertThat(count(route)).isEqualTo(3);
        var first=activity(route,false,2,null);assertThat(first.get("items").size()).isEqualTo(2);assertThat(first.get("nextCursor").isTextual()).isTrue();
        var second=activity(route,false,2,first.get("nextCursor").asText());assertThat(second.get("items").size()).isEqualTo(1);assertThat(second.get("nextCursor").isNull()).isTrue();
        Set<String> ids=new HashSet<>();for(var page:List.of(first,second))for(var event:page.get("items"))assertThat(ids.add(event.get("id").asText())).isTrue();
        String serialized=first.toString();assertThat(serialized).doesNotContain("ownerToken","request_hash","requestKey","route_id","Private text");
        moderate(route,id,"PENDING");assertThat(activity(route,false,100,null).get("items").size()).isEqualTo(1);
        assertThat(activity(route,true,100,null).get("items").size()).isEqualTo(4);
        moderate(route,id,"REJECTED");assertThat(activity(route,false,100,null).toString()).doesNotContain("Private author",id);
        mvc.perform(get("/api/routes/{id}/owner/activity",route.id())).andExpect(status().isForbidden());
        mvc.perform(get("/api/routes/{id}/activity",route.id()).param("limit","101")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/routes/{id}/activity",route.id()).param("cursor","invalid")).andExpect(status().isBadRequest());
    }
    @Test void commentsAndTheirActivityFollowBothCommentAndParentVisibility() throws Exception {
        Owned route=upload();String id=suggestion(route,"note");moderate(route,id,"PUBLISHED");
        String body="{\"authorName\":\"Hidden commenter\",\"content\":\"Private comment\"}";
        var request=post("/api/routes/{id}/suggestions/{sid}/comments",route.id(),id).header("Idempotency-Key","comment-key").contentType(MediaType.APPLICATION_JSON).content(body);
        String comment=read(mvc.perform(request).andExpect(status().isCreated())).get("publicId").asText();
        assertThat(read(mvc.perform(post("/api/routes/{id}/suggestions/{sid}/comments",route.id(),id).header("Idempotency-Key","comment-key").contentType(MediaType.APPLICATION_JSON).content(body))).get("publicId").asText()).isEqualTo(comment);
        assertThat(activity(route,false,100,null).toString()).doesNotContain("Hidden commenter",comment);
        assertThat(activity(route,true,100,null).toString()).contains("Hidden commenter",comment);
        mvc.perform(patch("/api/routes/{id}/suggestions/owner/comments/{cid}/moderation",route.id(),comment).cookie(route.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\"PUBLISHED\"}")).andExpect(status().isOk());
        assertThat(activity(route,false,100,null).toString()).contains("Hidden commenter",comment);
        // The visibility query also protects previously public comment events if their status is later withdrawn.
        jdbc.update("update suggestion_comments set moderation_status='PENDING' where public_id=?",comment);
        assertThat(activity(route,false,100,null).toString()).doesNotContain("Hidden commenter",comment);
        jdbc.update("update suggestion_comments set moderation_status='PUBLISHED' where public_id=?",comment);
        moderate(route,id,"PENDING");assertThat(activity(route,false,100,null).toString()).doesNotContain("Hidden commenter",comment,id);
    }
    @Test void metadataIsSharedAndDoesNotCreateGeometryVersionsAndHasOwnerAuthorization() throws Exception {
        Owned route=upload();String before=route(route).get("updatedAt").asText();
        String body=json.writeValueAsString(Map.of("name","Updated name","description","<script>plain text</script>","expectedUpdatedAt",before));
        mvc.perform(patch("/api/routes/{id}/owner/information",route.id()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mvc.perform(patch("/api/routes/{id}/owner/information",route.id()).cookie(route.cookie()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Updated name"));
        mvc.perform(patch("/api/routes/{id}/owner/information",route.id()).cookie(route.cookie()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        assertThat(count(route)).isEqualTo(2);
        var details=route(route);assertThat(details.get("versionCount").asInt()).isEqualTo(1);
        assertThat(read(mvc.perform(get("/api/routes/{id}/versions/1",route.id()))).get("description").asText()).isEqualTo("<script>plain text</script>");
        assertThat(jdbc.queryForObject("select v.name from route_versions v join routes r on r.id=v.route_id where r.public_id=?",String.class,route.id())).isEqualTo("Kwadraty Białołęka");
        mvc.perform(patch("/api/routes/{id}/owner/information",route.id()).cookie(route.cookie()).contentType(MediaType.APPLICATION_JSON).content(body.replace("Updated name","Another name"))).andExpect(status().isConflict());
        String large=json.writeValueAsString(Map.of("name","X","description","x".repeat(10001),"expectedUpdatedAt",details.get("updatedAt").asText()));
        mvc.perform(patch("/api/routes/{id}/owner/information",route.id()).cookie(route.cookie()).contentType(MediaType.APPLICATION_JSON).content(large)).andExpect(status().isBadRequest());
    }
    String editBody(JsonNode existing,double finish) throws Exception {
        return json.writeValueAsString(Map.of("baseVersionNumber",existing.get("currentVersion").asInt(),"name",existing.get("name").asText(),"editorDocument",Map.of("version",1,
            "points",List.of(Map.of("id","a","coordinate",List.of(21.0122,52.2297)),Map.of("id","b","coordinate",List.of(finish,52.23))),
            "segments",List.of(Map.of("id","s","fromId","a","toId","b","mode","DIRECT","geometry",List.of(List.of(21.0122,52.2297),List.of(finish,52.23)),"intendedGeometry",List.of(List.of(21.0122,52.2297),List.of(finish,52.23)))))));
    }
    @Test void exportIsVersionSpecificSafeAndNeverRequestsElevationAndOriginalIsExact() throws Exception {
        Owned route=upload();JsonNode initial=route(route);String edit=editBody(initial,21.04);
        mvc.perform(post("/api/routes/{id}/owner/versions",route.id()).cookie(route.cookie()).contentType(MediaType.APPLICATION_JSON).content(edit)).andExpect(status().isCreated());
        clearInvocations(heights);
        var latest=mvc.perform(get("/api/routes/{id}/gpx",route.id())).andExpect(status().isOk()).andReturn().getResponse();
        var historic=mvc.perform(get("/api/routes/{id}/versions/1/gpx",route.id())).andExpect(status().isOk()).andReturn().getResponse();
        var parser=new GpxParser();assertThat(parser.parse(latest.getContentAsByteArray()).points().getLast().longitude()).isEqualTo(21.04);
        assertThat(parser.parse(historic.getContentAsByteArray()).points().getLast().longitude()).isEqualTo(21.03);
        assertThat(latest.getHeader("Content-Disposition")).contains("kwadraty-bialoleka-v2.gpx");
        var without=mvc.perform(get("/api/routes/{id}/versions/1/gpx",route.id()).param("elevation","false").param("filename","../../Zła nazwa\r\n.gpx")).andExpect(status().isOk()).andReturn().getResponse();
        assertThat(new String(without.getContentAsByteArray(),StandardCharsets.UTF_8)).doesNotContain("<ele");
        assertThat(new String(historic.getContentAsByteArray(),StandardCharsets.UTF_8)).contains("<ele");
        assertThat(without.getHeader("Content-Disposition")).contains("zla-nazwa.gpx").doesNotContain("\r","\n","../");
        assertThat(mvc.perform(get("/api/routes/{id}/gpx/original",route.id())).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).isEqualTo(route.original());
        mvc.perform(get("/api/routes/{id}/versions/999/gpx",route.id())).andExpect(status().isNotFound());
        verifyNoInteractions(heights);
        assertThat(count(route)).isEqualTo(2);
    }
    @Test void failedMergeHasNoEventAndRepeatedMergeCreatesNeitherVersionNorEvent() throws Exception {
        Owned route=upload();double distance=route(route).get("distanceMeters").asDouble();
        String body=json.writeValueAsString(Map.of("type","DETOUR","authorName","Rider","description","Real detour","tags",List.of("safer"),
            "start",Map.of("longitude",21.0122,"latitude",52.2297,"distanceMeters",0),
            "end",Map.of("longitude",21.03,"latitude",52.24,"distanceMeters",distance),
            "proposedGeometry",Map.of("type","LineString","coordinates",List.of(List.of(21.0122,52.2297),List.of(21.025,52.235),List.of(21.03,52.24)))));
        String id=read(mvc.perform(post("/api/routes/{id}/suggestions",route.id()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated())).get("publicId").asText();
        int before=count(route);
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",route.id(),id).cookie(route.cookie())).andExpect(status().isConflict());
        assertThat(count(route)).isEqualTo(before);
        moderate(route,id,"PUBLISHED");
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",route.id(),id).cookie(route.cookie())).andExpect(status().isOk());
        assertThat(count(route)).isEqualTo(before+2);
        mvc.perform(post("/api/routes/{id}/suggestions/owner/{sid}/merge",route.id(),id).cookie(route.cookie())).andExpect(status().isConflict());
        assertThat(count(route)).isEqualTo(before+2);assertThat(route(route).get("versionCount").asInt()).isEqualTo(2);
        assertThat(activity(route,false,100,null).get("items").get(0).get("type").asText()).isEqualTo("SUGGESTION_MERGED");
    }

    @Test void versionResponsesProvideReusableOptimisticConcurrencyTimestamps() throws Exception {
        Owned route=upload();JsonNode previous=route(route);
        for(int i=0;i<2;i++) {
            var body=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(editBody(previous,21.04+i/100.0));
            body.put("expectedUpdatedAt",previous.get("updatedAt").asText());
            previous=read(mvc.perform(post("/api/routes/{id}/owner/versions",route.id()).cookie(route.cookie()).contentType(MediaType.APPLICATION_JSON).content(body.toString())).andExpect(status().isCreated()));
        }
        assertThat(previous.get("versionCount").asInt()).isEqualTo(3);assertThat(count(route)).isEqualTo(3);
    }

    @Test void openGeometryEditorCannotOverwriteNewSharedMetadataAndDrawnRoutesHaveNoOriginal() throws Exception {
        Owned route=upload();JsonNode initial=route(route);
        String information=json.writeValueAsString(Map.of("name","New shared name","expectedUpdatedAt",initial.get("updatedAt").asText()));
        mvc.perform(patch("/api/routes/{id}/owner/information",route.id()).cookie(route.cookie()).contentType(MediaType.APPLICATION_JSON).content(information)).andExpect(status().isOk());
        var stale=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(editBody(initial,21.05));stale.put("expectedUpdatedAt",initial.get("updatedAt").asText());
        mvc.perform(post("/api/routes/{id}/owner/versions",route.id()).cookie(route.cookie()).contentType(MediaType.APPLICATION_JSON).content(stale.toString())).andExpect(status().isConflict());
        assertThat(route(route).get("name").asText()).isEqualTo("New shared name");assertThat(count(route)).isEqualTo(2);
        var body=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(editBody(initial,21.05));body.remove("baseVersionNumber");
        var created=read(mvc.perform(post("/api/routes/drawn").contentType(MediaType.APPLICATION_JSON).content(body.toString())).andExpect(status().isCreated()));
        mvc.perform(get("/api/routes/{id}/gpx/original",created.get("publicId").asText())).andExpect(status().isNotFound());
        mvc.perform(get("/api/routes/{id}",created.get("publicId").asText())).andExpect(jsonPath("$.originalAvailable").value(false)).andExpect(jsonPath("$.creationSource").value("INITIAL_DRAWN"));
    }

    @Test void failedOwnerEditRollsBackMetadataVersionsFilesAndActivity() throws Exception {
        Owned route=upload();var original=route(route);int before=count(route);long files;
        try(var entries=Files.list(STORAGE)){files=entries.count();}
        when(heights.elevations(anyList())).thenThrow(new IllegalStateException("Simulated elevation failure"));
        assertThatThrownBy(()->mvc.perform(post("/api/routes/{id}/owner/versions",route.id()).cookie(route.cookie()).contentType(MediaType.APPLICATION_JSON).content(editBody(original,21.04).replace("Kwadraty Białołęka","Rolled back")))).hasRootCauseInstanceOf(IllegalStateException.class);
        assertThat(count(route)).isEqualTo(before);assertThat(route(route).get("name").asText()).isEqualTo("Kwadraty Białołęka");assertThat(route(route).get("currentVersion").asInt()).isEqualTo(1);
        try(var entries=Files.list(STORAGE)){assertThat(entries.count()).isEqualTo(files);}
    }
    @Test void transactionRollbackRemovesAnAlreadyWrittenActivityEvent() throws Exception {
        Owned route=upload();String expected=route(route).get("updatedAt").asText();int before=count(route);
        String body=json.writeValueAsString(Map.of("name","Uncommitted","expectedUpdatedAt",expected));
        assertThatThrownBy(()->new org.springframework.transaction.support.TransactionTemplate(transactions).execute(status->{
            try {mvc.perform(patch("/api/routes/{id}/owner/information",route.id()).cookie(route.cookie()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());}
            catch(Exception e){throw new RuntimeException(e);}
            assertThat(count(route)).isEqualTo(before+1);
            throw new IllegalStateException("Abort transaction after writing activity");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(count(route)).isEqualTo(before);assertThat(route(route).get("name").asText()).isEqualTo("Kwadraty Białołęka");
    }
    @Test void suggestionSettingsAndSoftDeletionProtectAllRelatedEndpointsWithoutDeletingData() throws Exception {
        Owned route=upload();String noteId=suggestion(route,"existing");
        mvc.perform(patch("/api/routes/{id}/owner/suggestions-settings",route.id()).contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}")).andExpect(status().isForbidden());
        for(int i=0;i<2;i++)mvc.perform(patch("/api/routes/{id}/owner/suggestions-settings",route.id()).cookie(route.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}")).andExpect(status().isOk());
        assertThat(count(route)).isEqualTo(3);
        mvc.perform(post("/api/routes/{id}/suggestions",route.id()).contentType(MediaType.APPLICATION_JSON).content(note)).andExpect(status().isConflict());
        moderate(route,noteId,"PUBLISHED");
        mvc.perform(delete("/api/routes/{id}/owner",route.id()).contentType(MediaType.APPLICATION_JSON).content("{\"confirmationName\":\"Kwadraty Białołęka\"}")).andExpect(status().isForbidden());
        mvc.perform(delete("/api/routes/{id}/owner",route.id()).cookie(route.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"confirmationName\":\"wrong\"}")).andExpect(status().isBadRequest());
        mvc.perform(delete("/api/routes/{id}/owner",route.id()).cookie(route.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"confirmationName\":\"Kwadraty Białołęka\"}")).andExpect(status().isNoContent());
        for(String suffix:List.of("","/versions","/versions/1","/gpx","/gpx/original","/activity","/suggestions","/suggestions/"+noteId,"/owner","/owner/editor","/owner/activity"))mvc.perform(get("/api/routes/"+route.id()+suffix).cookie(route.cookie())).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("select count(*) from route_versions v join routes r on r.id=v.route_id where r.public_id=?",Integer.class,route.id())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from route_suggestions s join routes r on r.id=s.route_id where r.public_id=?",Integer.class,route.id())).isEqualTo(1);
        assertThat(count(route)).isEqualTo(5);
    }
}
