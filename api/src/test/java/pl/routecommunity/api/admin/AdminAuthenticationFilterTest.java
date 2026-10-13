package pl.routecommunity.api.admin;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;

class AdminAuthenticationFilterTest {
    @Test void disabledByDefaultAndInvalidConfigurationFailsWithoutExposingSecret() throws Exception {
        var filter=new AdminAuthenticationFilter("",new ObjectMapper());
        var response=new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("GET","/api/admin/dashboard"),response,new MockFilterChain());
        assertThat(response.getStatus()).isEqualTo(503);
        assertThatThrownBy(()->new AdminAuthenticationFilter("weak-password",new ObjectMapper())).hasMessageNotContaining("weak-password");
    }
    @Test void limitsAuthenticationBeforeComparisonAndIgnoresPublicApi() throws Exception {
        String secret="ab".repeat(32);var filter=new AdminAuthenticationFilter(secret,new ObjectMapper());
        var valid=new MockHttpServletRequest("GET","/api/admin/dashboard");valid.addHeader("Authorization","Bearer "+secret);
        var authorized=new MockFilterChain();filter.doFilter(valid,new MockHttpServletResponse(),authorized);assertThat(authorized.getRequest()).isNotNull();
        for(int i=0;i<21;i++) {
            var response=new MockHttpServletResponse();
            filter.doFilter(new MockHttpServletRequest("GET","/api/admin/dashboard"),response,new MockFilterChain());
            assertThat(response.getStatus()).isEqualTo(i<20?401:429);
        }
        var request=new MockHttpServletRequest("GET","/api/admin/dashboard");request.addHeader("Authorization","Bearer "+secret);
        var chain=new MockFilterChain();var limited=new MockHttpServletResponse();filter.doFilter(request,limited,chain);
        assertThat(chain.getRequest()).isNull();assertThat(limited.getStatus()).isEqualTo(429);assertThat(limited.getHeader("Retry-After")).isEqualTo("60");
        var publicChain=new MockFilterChain();filter.doFilter(new MockHttpServletRequest("GET","/api/routes/example"),new MockHttpServletResponse(),publicChain);assertThat(publicChain.getRequest()).isNotNull();
    }
    @Test void encodedAndMatrixPathsCannotBypassAuthentication() throws Exception {
        for(String path:java.util.List.of("/api/admin;anything/dashboard","/api/%61dmin/dashboard")) {
            var response=new MockHttpServletResponse();
            new AdminAuthenticationFilter("ab".repeat(32),new ObjectMapper()).doFilter(new MockHttpServletRequest("GET",path),response,new MockFilterChain());
            assertThat(response.getStatus()).isEqualTo(401);
        }
    }
}
