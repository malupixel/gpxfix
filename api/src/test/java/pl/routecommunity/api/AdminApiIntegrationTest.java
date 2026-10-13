package pl.routecommunity.api;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;
import com.fasterxml.jackson.databind.*;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;
import pl.routecommunity.api.elevation.ElevationProvider;

@Testcontainers(disabledWithoutDocker=true)
@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class AdminApiIntegrationTest {
    static final String SECRET="1f".repeat(32); // Test fixture only; production requires random bytes.
    static final Path STORAGE;
    static {try{STORAGE=Files.createTempDirectory("tmr-admin-test-");}catch(Exception e){throw new ExceptionInInitializerError(e);}}
    @Container static final PostgreSQLContainer<?> POSTGRES=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r){
        r.add("spring.datasource.url",POSTGRES::getJdbcUrl);r.add("spring.datasource.username",POSTGRES::getUsername);
        r.add("spring.datasource.password",POSTGRES::getPassword);r.add("app.storage.gpx-path",STORAGE::toString);r.add("app.admin.secret",()->SECRET);
    }
    @Autowired MockMvc mvc; @Autowired JdbcTemplate jdbc; @Autowired ObjectMapper json;
    @MockitoBean ElevationProvider heights;
    @BeforeEach void elevation(){when(heights.elevations(anyList())).thenAnswer(call->{List<?> coordinates=call.getArgument(0);return coordinates.stream().map(c->100.0).toList();});}
    record Uploaded(long id,String publicId,jakarta.servlet.http.Cookie cookie,String name) { }
    Uploaded upload(String name) throws Exception {
        var response=mvc.perform(multipart("/api/routes").file(new MockMultipartFile("file","route.gpx","application/gpx+xml",new ClassPathResource("gpx/valid.gpx").getInputStream().readAllBytes())).param("name",name))
            .andExpect(status().isCreated()).andReturn().getResponse();
        String publicId=json.readTree(response.getContentAsString()).get("publicId").asText();
        long id=jdbc.queryForObject("SELECT id FROM routes WHERE public_id=?",Long.class,publicId);
        return new Uploaded(id,publicId,response.getCookie("route_owner"),name);
    }
    MockHttpServletRequestBuilder admin(MockHttpServletRequestBuilder request){return request.header("Authorization","Bearer "+SECRET);}
    JsonNode read(ResultActions response) throws Exception {return json.readTree(response.andReturn().getResponse().getContentAsString());}
    void change(Uploaded r,boolean deleted) throws Exception {
        mvc.perform(admin(patch("/api/admin/routes/{id}/status",r.id())).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("deleted",deleted,"expectedDeleted",!deleted,"confirmationName",r.name())))).andExpect(status().isOk());
    }

    @Test void allAdministrativeEndpointsRequireSeparateSecret() throws Exception {
        Uploaded r=upload("Auth test");
        for(String endpoint:List.of("dashboard","system","routes","suggestions","routes/"+r.id(),"routes/"+r.id()+"/versions","routes/"+r.id()+"/activity","routes/"+r.id()+"/files","routes/"+r.id()+"/permanent-delete-plan")) {
            mvc.perform(get("/api/admin/"+endpoint)).andExpect(status().isUnauthorized());
        }
        mvc.perform(get("/api/admin/dashboard").cookie(r.cookie())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/dashboard").header("Authorization","Bearer "+"2a".repeat(32))).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/admin/routes/{id}/status",r.id())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/routes/bulk-soft-delete")).andExpect(status().isUnauthorized());
        mvc.perform(admin(get("/api/admin/dashboard"))).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"));
        mvc.perform(get("/api/routes/{id}",r.publicId())).andExpect(status().isOk());
        mvc.perform(get("/api/routes/{id}/owner",r.publicId()).header("Authorization","Bearer "+SECRET)).andExpect(status().isForbidden());
        mvc.perform(get("/api/routes/{id}/owner",r.publicId()).cookie(r.cookie())).andExpect(status().isOk());
    }

    @Test void realPaginationSearchFiltersDetailsAndDiagnostics() throws Exception {
        Uploaded a=upload("AdminUnique test alpha"),b=upload("AdminUnique debug beta");
        change(b,true);
        var first=read(mvc.perform(admin(get("/api/admin/routes")).param("search","AdminUnique").param("size","1").param("sort","id").param("direction","ASC")).andExpect(status().isOk()));
        assertThat(first.get("total").asLong()).isEqualTo(2);assertThat(first.get("items").size()).isEqualTo(1);
        assertThat(first.get("items").get(0).get("id").asLong()).isEqualTo(a.id());
        var second=read(mvc.perform(admin(get("/api/admin/routes")).param("search","AdminUnique").param("size","1").param("page","1").param("sort","id").param("direction","ASC")).andExpect(status().isOk()));
        assertThat(second.get("items").get(0).get("deletedAt").isTextual()).isTrue();
        for(String search:List.of(String.valueOf(b.id()),b.publicId())) {
            var deleted=read(mvc.perform(admin(get("/api/admin/routes")).param("search",search).param("status","DELETED")).andExpect(status().isOk()));
            assertThat(deleted.get("items").toString()).contains(b.publicId());
        }
        var active=read(mvc.perform(admin(get("/api/admin/routes")).param("search","AdminUnique").param("status","ACTIVE")).andExpect(status().isOk()));
        assertThat(active.get("total").asLong()).isEqualTo(1);
        var old=read(mvc.perform(admin(get("/api/admin/routes")).param("search","AdminUnique").param("to","2000-01-01")).andExpect(status().isOk()));
        assertThat(old.get("total").asLong()).isZero();
        var candidates=read(mvc.perform(admin(get("/api/admin/routes")).param("search","AdminUnique").param("candidate","TEST_NAME")).andExpect(status().isOk()));
        assertThat(candidates.get("total").asLong()).isEqualTo(2);
        for(var params:List.of(Map.of("size","101"),Map.of("page","-1"),Map.of("sort","owner_token_hash"),Map.of("from","bad"),Map.of("status","UNKNOWN"),Map.of("candidate","oops"))) {
            var request=admin(get("/api/admin/routes"));params.forEach(request::param);mvc.perform(request).andExpect(status().isBadRequest());
        }
        var details=read(mvc.perform(admin(get("/api/admin/routes/{id}",b.id()))).andExpect(status().isOk()));
        assertThat(details.get("srid").asInt()).isEqualTo(4326);assertThat(details.get("pointCount").asInt()).isGreaterThan(1);
        assertThat(details.toString()).doesNotContain("ownerToken","token_hash","coordinates");
        mvc.perform(admin(get("/api/admin/routes/{id}/versions",b.id()))).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
        mvc.perform(admin(get("/api/admin/system"))).andExpect(status().isOk()).andExpect(jsonPath("$.databaseConnected").value(true)).andExpect(jsonPath("$.permanentDeleteEnabled").value(false));
    }

    @Test void softDeleteRestoreAndDryRunPreserveDataAndFiles() throws Exception {
        Uploaded r=upload("Restore test");
        long version=jdbc.queryForObject("SELECT current_version_id FROM routes WHERE id=?",Long.class,r.id());
        long fileCount;try(var files=Files.list(STORAGE)){fileCount=files.count();}
        change(r,true);
        mvc.perform(get("/api/routes/{id}",r.publicId())).andExpect(status().isNotFound());
        var plan=read(mvc.perform(admin(get("/api/admin/routes/{id}/permanent-delete-plan",r.id()))).andExpect(status().isOk()));
        assertThat(plan.get("versions").asLong()).isEqualTo(1);assertThat(plan.get("executable").asBoolean()).isFalse();
        assertThat(plan.get("files").size()).isGreaterThan(0);
        mvc.perform(admin(delete("/api/admin/routes/{id}",r.id()))).andExpect(status().isMethodNotAllowed());
        change(r,false);change(r,true);change(r,false);
        mvc.perform(get("/api/routes/{id}",r.publicId())).andExpect(status().isOk());
        mvc.perform(get("/api/routes/{id}/owner",r.publicId()).cookie(r.cookie())).andExpect(status().isOk());
        var ownerActivity=read(mvc.perform(get("/api/routes/{id}/owner/activity",r.publicId()).cookie(r.cookie())).andExpect(status().isOk()));
        assertThat(ownerActivity.get("items").toString()).doesNotContain("ADMIN","ROUTE_RESTORED");
        assertThat(jdbc.queryForObject("SELECT current_version_id FROM routes WHERE id=?",Long.class,r.id())).isEqualTo(version);
        try(var files=Files.list(STORAGE)){assertThat(files.count()).isEqualTo(fileCount);}
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit WHERE resource_id=? AND result='SUCCESS'",Integer.class,r.id())).isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM route_activity WHERE route_id=? AND actor_kind='ADMIN'",Integer.class,r.id())).isEqualTo(4);
    }

    @Test void bulkIsAtomicAndAuditsRejectedStatuses() throws Exception {
        Uploaded a=upload("Bulk alpha"),b=upload("Bulk beta");change(b,true);
        var request=admin(post("/api/admin/routes/bulk-soft-delete")).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("routeIds",List.of(a.id(),b.id()),"confirmed",true)));
        mvc.perform(request).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT deleted_at IS NULL FROM routes WHERE id=?",Boolean.class,a.id())).isTrue();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit WHERE operation='BULK_SOFT_DELETE' AND result='REJECTED' AND resource_id IN (?,?)",Integer.class,a.id(),b.id())).isEqualTo(2);
        change(b,false);mvc.perform(request).andExpect(status().isOk()).andExpect(jsonPath("$.changed").value(2));
        mvc.perform(admin(post("/api/admin/routes/bulk-soft-delete")).contentType(MediaType.APPLICATION_JSON).content("{\"routeIds\":[1],\"confirmed\":false}")).andExpect(status().isBadRequest());
        mvc.perform(admin(post("/api/admin/routes/bulk-soft-delete")).contentType(MediaType.APPLICATION_JSON).content("{\"routeIds\":[1,1],\"confirmed\":true}")).andExpect(status().isBadRequest());
    }

    @Test void suggestionsRemainReadOnlyAndDryRunIncludesAllDependencies() throws Exception {
        Uploaded r=upload("AdminSuggestionScope");
        String note="""
            {"type":"NOTE","authorName":"Contributor","description":"Admin read-only note","category":"water","tags":[],"start":{"longitude":21.0122,"latitude":52.2297,"distanceMeters":0}}
            """;
        var suggestion=read(mvc.perform(post("/api/routes/{id}/suggestions",r.publicId()).contentType(MediaType.APPLICATION_JSON).content(note)).andExpect(status().isCreated()));
        String sid=suggestion.get("publicId").asText();
        mvc.perform(patch("/api/routes/{id}/suggestions/owner/{sid}/moderation",r.publicId(),sid).cookie(r.cookie()).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\"PUBLISHED\"}")).andExpect(status().isOk());
        mvc.perform(post("/api/routes/{id}/suggestions/{sid}/comments",r.publicId(),sid).contentType(MediaType.APPLICATION_JSON).content("{\"authorName\":\"Comment author\",\"content\":\"Review comment\"}")).andExpect(status().isCreated());
        var page=read(mvc.perform(admin(get("/api/admin/suggestions")).param("search",r.publicId()).param("status","PUBLISHED").param("size","1")).andExpect(status().isOk()));
        assertThat(page.get("total").asLong()).isEqualTo(1);assertThat(page.get("items").get(0).get("type").asText()).isEqualTo("NOTE");
        assertThat(page.get("items").get(0).get("description").asText()).isEqualTo("Admin read-only note");
        mvc.perform(admin(get("/api/admin/suggestions")).param("routeId",String.valueOf(r.id())).param("status","REJECTED")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(0));
        mvc.perform(patch("/api/routes/{id}/suggestions/owner/{sid}/moderation",r.publicId(),sid).header("Authorization","Bearer "+SECRET).contentType(MediaType.APPLICATION_JSON).content("{\"moderationStatus\":\"REJECTED\"}")).andExpect(status().isForbidden());
        long version=jdbc.queryForObject("SELECT current_version_id FROM routes WHERE id=?",Long.class,r.id());
        String revision="cd".repeat(32);
        jdbc.update("INSERT INTO route_share_previews(version_id,name,revision) VALUES (?,?,?)",version,r.name(),revision);
        change(r,true);
        var plan=read(mvc.perform(admin(get("/api/admin/routes/{id}/permanent-delete-plan",r.id()))).andExpect(status().isOk()));
        assertThat(plan.get("suggestions").asInt()).isEqualTo(1);assertThat(plan.get("comments").asInt()).isEqualTo(1);
        assertThat(plan.get("ownerSessions").asInt()).isGreaterThan(0);assertThat(plan.get("previewJobs").asInt()).isEqualTo(1);
        assertThat(plan.get("activity").asInt()).isGreaterThan(2);assertThat(plan.get("files").toString()).contains(revision+".png");
        mvc.perform(admin(get("/api/admin/routes/{id}/files",r.id())).param("size","1")).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));
        assertThat(jdbc.queryForObject("SELECT moderation_status FROM route_suggestions WHERE public_id=?",String.class,sid)).isEqualTo("PUBLISHED");
    }

    @Test void candidateFiltersReviewUnusualRoutesWithoutChangingThem() throws Exception {
        Uploaded r=upload("CandidateUnique");
        jdbc.update("UPDATE route_versions SET distance_meters=900 WHERE route_id=?",r.id());
        mvc.perform(admin(get("/api/admin/routes")).param("search",r.publicId()).param("candidate","SHORT")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
        jdbc.update("UPDATE routes SET name='' WHERE id=?",r.id());
        mvc.perform(admin(get("/api/admin/routes")).param("search",r.publicId()).param("candidate","UNNAMED")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
        jdbc.update("UPDATE routes SET created_at=now()-interval '200 days' WHERE id=?",r.id());
        mvc.perform(admin(get("/api/admin/routes")).param("search",r.publicId()).param("candidate","OLD_WITHOUT_SUGGESTIONS")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
        jdbc.update("UPDATE route_versions SET distance_meters=0 WHERE route_id=?",r.id());
        mvc.perform(admin(get("/api/admin/routes")).param("search",r.publicId()).param("candidate","INCOMPLETE")).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(1));
        assertThat(jdbc.queryForObject("SELECT deleted_at IS NULL FROM routes WHERE id=?",Boolean.class,r.id())).isTrue();
        // Empty legacy names can still be reviewed and deleted with explicit UI confirmation.
        mvc.perform(admin(patch("/api/admin/routes/{id}/status",r.id())).contentType(MediaType.APPLICATION_JSON).content("{\"deleted\":true,\"expectedDeleted\":false,\"confirmationName\":\"\"}")).andExpect(status().isOk());
    }
}
