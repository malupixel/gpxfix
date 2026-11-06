package pl.routecommunity.api;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker=true) @SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class RouteBranchIntegrationTest {
    static final Path STORAGE;
    static {try {STORAGE=Files.createTempDirectory("tmr-branches-");}catch(Exception e){throw new ExceptionInInitializerError(e);}}
    @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r){r.add("spring.datasource.url",DB::getJdbcUrl);r.add("spring.datasource.username",DB::getUsername);r.add("spring.datasource.password",DB::getPassword);r.add("app.storage.gpx-path",STORAGE::toString);r.add("app.elevation.enabled",()->"false");}
    @org.springframework.test.context.bean.override.mockito.MockitoBean pl.routecommunity.api.elevation.ElevationProvider elevationProvider;
    @org.junit.jupiter.api.BeforeEach void elevations(){org.mockito.Mockito.when(elevationProvider.elevations(org.mockito.ArgumentMatchers.anyList())).thenAnswer(call->{java.util.List<?> points=call.getArgument(0);return points.stream().map(point->100.0).toList();});}
    @Autowired MockMvc mvc; @Autowired ObjectMapper json; @Autowired JdbcTemplate jdbc;
    record Seed(String id,String token,Cookie owner) { }
    Seed seed() throws Exception {
        var result=mvc.perform(multipart("/api/routes").file(new MockMultipartFile("file","route.gpx","application/gpx+xml",new ClassPathResource("gpx/valid.gpx").getInputStream().readAllBytes())).param("name","Original")) .andExpect(status().isCreated()).andReturn();
        var data=json.readTree(result.getResponse().getContentAsString());return new Seed(data.path("publicId").asText(),data.path("managementToken").asText(),result.getResponse().getCookie("route_owner"));
    }
    JsonNode read(MockHttpServletRequestBuilder request,int code) throws Exception {return json.readTree(mvc.perform(request).andExpect(status().is(code)).andReturn().getResponse().getContentAsString());}
    MockHttpServletRequestBuilder body(MockHttpServletRequestBuilder request,Object value)throws Exception{return request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsBytes(value));}
    String path(Seed s){return "/api/routes/"+s.id();}
    String branch(Seed s,int version,String name)throws Exception{return read(body(post(path(s)+"/owner/branches").cookie(s.owner()),Map.of("versionNumber",version,"name",name)),201).path("publicId").asText();}
    JsonNode route(Seed s,String branch)throws Exception{return read(get(path(s)).param("branch",branch),200);}
    Map<String,Object> editBody(int base,double longitude){
        return Map.of("baseVersionNumber",base,"name","Original","editorDocument",Map.of("version",1,"points",List.of(Map.of("id","a","coordinate",List.of(21.0122,52.2297)),Map.of("id","b","coordinate",List.of(longitude,52.24))),"segments",List.of(Map.of("id","ab","fromId","a","toId","b","mode","DIRECT","geometry",List.of(List.of(21.0122,52.2297),List.of(longitude,52.24))))));
    }
    JsonNode edit(Seed s,String branch,int base,double longitude)throws Exception{return read(body(post(path(s)+"/owner/versions").param("branch",branch).cookie(s.owner()),editBody(base,longitude)),201);}
    @Test void branchesShareAncestryButEditIndependentlyAndEnforceConflicts()throws Exception{
        Seed s=seed();
        read(body(post(path(s)+"/suggestions"),Map.of("type","NOTE","authorName","A","description","Missing base","start",Map.of("longitude",21.0122,"latitude",52.2297,"distanceMeters",0))),409);
        JsonNode original=route(s,"main");String currentFork=branch(s,1,"Current");
        edit(s,"main",1,21.04);String historical=branch(s,1,"Historical");
        assertThat(route(s,historical).path("geometry")).isEqualTo(original.path("geometry"));
        assertThat(jdbc.queryForObject("select count(*) from route_versions v join routes r on r.id=v.route_id where r.public_id=?",Integer.class,s.id())).isEqualTo(2);
        JsonNode third=edit(s,historical,1,21.06);assertThat(third.path("currentVersion").asInt()).isEqualTo(3);
        String nested=branch(s,3,"Nested");edit(s,nested,3,21.08);
        assertThat(route(s,"main").path("currentVersion").asInt()).isEqualTo(2);
        assertThat(route(s,currentFork).path("currentVersion").asInt()).isEqualTo(1);
        assertThat(route(s,historical).path("geometry")).isEqualTo(third.path("geometry"));
        JsonNode history=read(get(path(s)+"/versions").param("branch",nested),200);
        assertThat(history.findValuesAsText("versionNumber")).containsExactly("4","3","1");
        assertThat(history.get(1).path("basedOnVersionNumber").asInt()).isEqualTo(1);
        read(body(post(path(s)+"/owner/versions").cookie(s.owner()).param("branch",historical),editBody(1,21.1)),409);
        read(body(post(path(s)+"/owner/versions").param("branch",historical),editBody(3,21.1)),403);
        read(body(post(path(s)+"/owner/branches"),Map.of("name","No","versionNumber",1)),403);
        read(body(patch(path(s)+"/owner/versions/1/label").cookie(s.owner()),Map.of("label","Before climb")),204);
        assertThat(read(get(path(s)+"/versions").param("branch",nested),200).get(2).path("label").asText()).isEqualTo("Before climb");
        assertThat(route(s,currentFork).path("geometry")).isEqualTo(original.path("geometry"));
        assertThat(read(get(path(s)+"/share").param("branch",nested),200).path("versionNumber").asInt()).isEqualTo(4);
        mvc.perform(get(path(s)+"/gpx").param("branch",nested)).andExpect(status().isOk()).andExpect(content().string(org.hamcrest.Matchers.containsString("21.08")));
        assertThatThrownBy(()->jdbc.update("update route_versions set based_on_version_id=id where route_id=(select id from routes where public_id=?)",s.id())).isInstanceOf(Exception.class);
        assertThatThrownBy(()->jdbc.update("update route_branches set fork_version_id=current_version_id where public_id=?",nested)).isInstanceOf(Exception.class);
    }
    @Test void suggestionMergeAndCommentsAreIsolatedAndStaleSubmissionIsRejected()throws Exception {
        Seed s=seed();String b=branch(s,1,"Gravel");JsonNode original=route(s,"main");
        var coordinates=original.path("geometry").path("coordinates");var last=coordinates.get(coordinates.size()-1);
        Map<String,Object> suggestion=new HashMap<>(Map.of("baseVersionNumber",1,"type","DETOUR","authorName","Visitor","description","Detour","tags",List.of(),"start",Map.of("longitude",21.0122,"latitude",52.2297,"distanceMeters",0),"end",Map.of("longitude",last.get(0).asDouble(),"latitude",last.get(1).asDouble(),"distanceMeters",original.path("distanceMeters").asDouble()),"proposedGeometry",Map.of("type","LineString","coordinates",List.of(List.of(21.0122,52.2297),List.of(21.014,52.229),List.of(last.get(0).asDouble(),last.get(1).asDouble())))));
        String sid=read(body(post(path(s)+"/suggestions").param("branch",b),suggestion),201).path("publicId").asText();
        assertThat(read(get(path(s)+"/suggestions/owner").cookie(s.owner()),200)).isEmpty();
        read(body(patch(path(s)+"/suggestions/owner/"+sid+"/moderation").cookie(s.owner()),Map.of("moderationStatus","PUBLISHED")),404);
        read(body(patch(path(s)+"/suggestions/owner/"+sid+"/moderation").cookie(s.owner()).param("branch",b),Map.of("moderationStatus","PUBLISHED")),200);
        assertThat(read(get(path(s)+"/suggestions").param("includeArchived","true"),200)).isEmpty();
        read(body(post(path(s)+"/suggestions/"+sid+"/comments"),Map.of("authorName","A","content","wrong branch")),404);
        read(body(post(path(s)+"/suggestions/"+sid+"/comments").param("branch",b),Map.of("authorName","A","content","right branch")),201);
        read(post(path(s)+"/suggestions/owner/"+sid+"/merge").cookie(s.owner()),404);
        JsonNode merged=read(post(path(s)+"/suggestions/owner/"+sid+"/merge").cookie(s.owner()).param("branch",b),200);
        assertThat(merged.path("currentVersion").asInt()).isEqualTo(2);
        assertThat(route(s,"main").path("geometry")).isEqualTo(original.path("geometry"));
        assertThat(route(s,b).path("geometry")).isNotEqualTo(original.path("geometry"));
        read(body(post(path(s)+"/suggestions").param("branch",b),suggestion),409);
        suggestion.remove("baseVersionNumber");read(body(post(path(s)+"/suggestions").param("branch",b),suggestion),409);
        assertThat(read(get(path(s)+"/activity"),200).path("items").findValuesAsText("suggestionPublicId")).doesNotContain(sid);
        assertThat(read(get(path(s)+"/activity").param("branch",b),200).path("items").findValuesAsText("suggestionPublicId")).contains(sid);
    }
    @Test void copyHasIndependentOwnershipExactGeometryAndFilesAndSurvivesSourceDeletion()throws Exception {
        Seed s=seed();String branch=branch(s,1,"Variant");edit(s,branch,1,21.08);
        JsonNode variant=route(s,branch);
        JsonNode copiedVariant=read(body(post(path(s)+"/versions/2/copy").param("branch",branch),Map.of("name","Variant copy")),201);
        JsonNode variantCopy=read(get("/api/routes/"+copiedVariant.path("publicId").asText()),200);
        assertThat(variantCopy.path("geometry")).isEqualTo(variant.path("geometry"));
        assertThat(variantCopy.path("elevationProfile")).isEqualTo(variant.path("elevationProfile"));
        JsonNode source=read(get(path(s)+"/versions/1"),200);
        var result=mvc.perform(body(post(path(s)+"/versions/1/copy"),Map.of("name","Independent","description","Copy"))).andExpect(status().isCreated()).andReturn();
        JsonNode created=json.readTree(result.getResponse().getContentAsString());String id=created.path("publicId").asText();
        assertThat(created.path("managementToken").asText()).isNotEqualTo(s.token());
        read(get("/api/routes/"+id+"/owner").cookie(s.owner()),403);
        read(get(path(s)+"/owner").cookie(result.getResponse().getCookie("route_owner")),403);
        mvc.perform(get("/api/routes/"+id+"/owner").cookie(result.getResponse().getCookie("route_owner"))).andExpect(status().isOk());
        JsonNode copy=read(get("/api/routes/"+id),200);
        assertThat(copy.path("geometry")).isEqualTo(source.path("geometry"));assertThat(copy.path("elevationProfile")).isEqualTo(source.path("elevationProfile"));
        assertThat(copy.path("currentVersion").asInt()).isEqualTo(1);assertThat(copy.path("sourceRoutePublicId").asText()).isEqualTo(s.id());
        String sql="select v.storage_key from route_versions v join routes r on r.id=v.route_id where r.public_id=? and v.version_number=1";
        String first=jdbc.queryForObject(sql,String.class,s.id()),second=jdbc.queryForObject(sql,String.class,id);
        assertThat(second).isNotEqualTo(first);assertThat(Files.readAllBytes(STORAGE.resolve(second))).isEqualTo(Files.readAllBytes(STORAGE.resolve(first)));
        assertThat(read(get("/api/routes/"+id+"/suggestions"),200)).isEmpty();
        mvc.perform(body(delete(path(s)+"/owner").cookie(s.owner()),Map.of("confirmationName","Original"))).andExpect(status().isNoContent());
        read(get(path(s)).param("branch",branch),404);read(body(post(path(s)+"/versions/1/copy"),Map.of("name","No")),404);
        assertThat(read(get("/api/routes/"+id),200).path("geometry")).isEqualTo(source.path("geometry"));
    }
    @Test void editingMainDoesNotInvalidateAnEditorOnAnotherBranchWithUnchangedSharedMetadata()throws Exception {
        Seed s=seed();String branch=branch(s,1,"Independent");
        String before=route(s,branch).path("updatedAt").asText();
        edit(s,"main",1,21.06);
        var request=new HashMap<String,Object>(editBody(1,21.08));request.put("expectedUpdatedAt",before);
        read(body(post(path(s)+"/owner/versions").cookie(s.owner()).param("branch",branch),request),201);
        assertThat(route(s,"main").path("currentVersion").asInt()).isEqualTo(2);
        assertThat(route(s,branch).path("currentVersion").asInt()).isEqualTo(3);
    }
    @Test void concurrentEditsOnOneBranchConflictWhileSeparateBranchesBothAdvance()throws Exception {
        Seed s=seed();String a=branch(s,1,"A"),b=branch(s,1,"B");
        try(var pool=Executors.newFixedThreadPool(2)){
            var futures=pool.invokeAll(List.of(()->mvc.perform(body(post(path(s)+"/owner/versions").cookie(s.owner()).param("branch",a),editBody(1,21.05))).andReturn().getResponse().getStatus(),()->mvc.perform(body(post(path(s)+"/owner/versions").cookie(s.owner()).param("branch",a),editBody(1,21.06))).andReturn().getResponse().getStatus()));
            assertThat(List.of(futures.get(0).get(),futures.get(1).get())).containsExactlyInAnyOrder(201,409);
            int head=route(s,a).path("currentVersion").asInt();
            var separate=pool.invokeAll(List.of(()->mvc.perform(body(post(path(s)+"/owner/versions").cookie(s.owner()).param("branch",a),editBody(head,21.07))).andReturn().getResponse().getStatus(),()->mvc.perform(body(post(path(s)+"/owner/versions").cookie(s.owner()).param("branch",b),editBody(1,21.08))).andReturn().getResponse().getStatus()));
            assertThat(List.of(separate.get(0).get(),separate.get(1).get())).containsOnly(201);
        }
        assertThat(route(s,"main").path("currentVersion").asInt()).isEqualTo(1);
    }
}
