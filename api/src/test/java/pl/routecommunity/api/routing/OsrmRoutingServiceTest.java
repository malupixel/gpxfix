package pl.routecommunity.api.routing;

import java.util.List;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;

class OsrmRoutingServiceTest {
    private final RestClient.Builder builder=RestClient.builder();
    private final MockRestServiceServer server=MockRestServiceServer.bindTo(builder).build();
    private final OsrmRoutingService service=new OsrmRoutingService(builder,"https://routing.test","cycling",50);
    private final List<Double> from=List.of(21.0,52.0001),to=List.of(21.001,52.0001);
    private String response(double lat){return """
        {"code":"Ok","waypoints":[{"location":[21,%s]},{"location":[21.001,%s]}],
        "routes":[{"geometry":{"coordinates":[[21,%s],[21.001,%s]]},"legs":[{"steps":[{"geometry":{"coordinates":[[21,%s],[21.001,%s]]}}]}]}]}
        """.formatted(lat,lat,lat,lat,lat,lat);}
    @Test void returnsMatchedWaypointsAndLegsFromTheSameProfileRequest(){
        server.expect(requestTo(org.hamcrest.Matchers.containsString("/route/v1/cycling/"))).andExpect(queryParam("radiuses","50.0%3B50.0")).andRespond(withSuccess(response(52),MediaType.APPLICATION_JSON));
        var result=service.matched(List.of(from,to));
        assertThat(result.waypoints()).containsExactly(List.of(21.0,52.0),List.of(21.001,52.0));
        assertThat(result.segments().getFirst()).isEqualTo(result.coordinates());server.verify();
    }
    @Test void rejectsFarMatchesEvenIfEngineIgnoresRadius(){
        server.expect(anything()).andRespond(withSuccess(response(52.01),MediaType.APPLICATION_JSON));
        assertThatThrownBy(()->service.route(from,to)).hasMessageContaining("snap limit");
    }
    @Test void routingFailureAndMalformedResponseNeverCreateAStraightFallback(){
        server.expect(anything()).andRespond(withSuccess("{\"code\":\"NoRoute\"}",MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withSuccess("{\"code\":\"Ok\",\"routes\":[]}",MediaType.APPLICATION_JSON));
        assertThatThrownBy(()->service.route(from,to)).hasMessageContaining("snap limit");
        assertThatThrownBy(()->service.route(from,to)).hasMessageContaining("snap limit");
    }
    @Test void missingWaypointOrDiscontinuousLegIsRejected(){
        server.expect(anything()).andRespond(withSuccess(response(52).replace("\"location\":[21,52.0]","\"location\":[21.00001,52.0]"),MediaType.APPLICATION_JSON));
        assertThatThrownBy(()->service.route(from,to)).hasMessageContaining("snap limit");
    }
}
