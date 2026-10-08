package pl.routecommunity.api.route;
import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;

class GpxExportServiceTest {
    @Test void filenamesAreSafeAndDefaultNamesKeepVersionEvenForVeryLongNames() {
        assertThat(GpxExportService.filename("../../Białołęka\r\n.gpx")).isEqualTo("bialoleka.gpx");
        assertThat(GpxExportService.filename("✨" )).isEqualTo("route.gpx");
        assertThat(GpxExportService.defaultFilename("Kwadraty Białołęka",4)).isEqualTo("kwadraty-bialoleka-v4.gpx");
        assertThat(GpxExportService.defaultFilename("a".repeat(200),123)).endsWith("-v123.gpx").hasSize(164);
    }
}
