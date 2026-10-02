package pl.routecommunity.api.route;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
interface RouteVersionRepository extends JpaRepository<RouteVersion,Long> {
    Optional<RouteVersion> findByRoute_PublicIdAndVersionNumber(String publicId,int versionNumber);
    @EntityGraph(attributePaths={"basedOnVersion","mergedSuggestion"})
    List<RouteVersion> findByRoute_PublicIdOrderByVersionNumberDesc(String publicId);
}
