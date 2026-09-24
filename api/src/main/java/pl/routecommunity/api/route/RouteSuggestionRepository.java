package pl.routecommunity.api.route;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface RouteSuggestionRepository extends JpaRepository<RouteSuggestion,Long> {
    boolean existsByPublicId(String publicId);
    List<RouteSuggestion> findByRoute_PublicIdOrderByStartDistanceMetersAscCreatedAtAsc(String publicId);
}
