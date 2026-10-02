package pl.routecommunity.api.route;
import org.locationtech.jts.geom.LineString;
interface SuggestionMergeHandler {
    boolean supports(SuggestionType type);
    LineString apply(RouteSuggestion suggestion,RouteVersion current);
}
