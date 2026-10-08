package pl.routecommunity.api.route;
import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;
import pl.routecommunity.api.common.error.ApiException;

class RouteMetadataTextTest {
    @Test void plainTextIncludesUnicodeAndMarkupButRejectsCharactersThatWouldCorruptGpx() {
        assertThat(RouteMetadataText.name("  Białołęka 🚲  ")).isEqualTo("Białołęka 🚲");
        assertThat(RouteMetadataText.description(" <script>alert('x')</script>\nRide ")).isEqualTo("<script>alert('x')</script>\nRide");
        assertThat(RouteMetadataText.description("  ")).isNull();
        assertThatThrownBy(()->RouteMetadataText.description("Control\u0001character")).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->RouteMetadataText.name("\ud800")).isInstanceOf(ApiException.class);
        assertThatThrownBy(()->RouteMetadataText.description("x".repeat(10001))).isInstanceOf(ApiException.class);
    }
}
