package pl.routecommunity.api.route;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface RouteSuggestionRepository extends JpaRepository<RouteSuggestion,Long> {
    boolean existsByPublicId(String publicId);
    List<RouteSuggestion> findByRoute_PublicIdAndModerationStatusOrderByStartDistanceMetersAscCreatedAtAsc(String publicId,ModerationStatus status);
    List<RouteSuggestion> findByRoute_PublicIdOrderByCreatedAtAsc(String publicId);
    java.util.Optional<RouteSuggestion> findByRoute_PublicIdAndPublicId(String routePublicId,String suggestionPublicId);
    java.util.Optional<RouteSuggestion> findByRoute_PublicIdAndPublicIdAndModerationStatus(String routePublicId,String suggestionPublicId,ModerationStatus status);
}
