package pl.routecommunity.api.route;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class RouteSuggestionLifecycleTest {
    private RouteSuggestion suggestion() {
        var route = new Route("route", new byte[32], Instant.now());
        var base = mock(RouteVersion.class);
        when(base.getRoute()).thenReturn(route);
        return new RouteSuggestion("suggestion", route, base, SuggestionType.DETOUR, "Owner", "Detour", null, null,
                null, null, null, 0, 100.0, Instant.now());
    }

    @Test void moderationTransitionMatrixHasOnlyTheFourSupportedTransitions() {
        for (var from : ModerationStatus.values()) for (var to : ModerationStatus.values()) {
            var suggestion = suggestion();
            if (from != ModerationStatus.PENDING) suggestion.moderate(from, Instant.now());
            boolean valid = from == ModerationStatus.PENDING && List.of(ModerationStatus.PUBLISHED, ModerationStatus.REJECTED).contains(to)
                    || from == ModerationStatus.PUBLISHED && List.of(ModerationStatus.PENDING, ModerationStatus.REJECTED).contains(to);
            if (valid) {
                suggestion.moderate(to, Instant.now());
                assertThat(suggestion.getModerationStatus()).isEqualTo(to);
            } else {
                assertThatThrownBy(() -> suggestion.moderate(to, Instant.now())).isInstanceOf(IllegalStateException.class);
                assertThat(suggestion.getModerationStatus()).isEqualTo(from);
            }
        }
    }

    @Test void mergedSuggestionsCannotReturnToAnyModerationState() {
        var suggestion = suggestion();
        suggestion.moderate(ModerationStatus.PUBLISHED, Instant.now());
        var merged = mock(RouteVersion.class);
        when(merged.getRoute()).thenReturn(suggestion.getRoute());
        suggestion.mergeInto(merged, Instant.now());
        for (var target : ModerationStatus.values()) assertThatThrownBy(() -> suggestion.moderate(target, Instant.now())).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> suggestion.mergeInto(merged, Instant.now())).isInstanceOf(IllegalStateException.class);
    }
}
