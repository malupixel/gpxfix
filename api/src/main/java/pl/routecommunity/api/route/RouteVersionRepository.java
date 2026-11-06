package pl.routecommunity.api.route;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
interface RouteVersionRepository extends JpaRepository<RouteVersion,Long> {
    @org.springframework.data.jpa.repository.Query(value="WITH RECURSIVE history AS (SELECT id,based_on_version_id FROM route_versions WHERE id=:head UNION ALL SELECT p.id,p.based_on_version_id FROM route_versions p JOIN history c ON p.id=c.based_on_version_id) SELECT count(*) FROM history",nativeQuery=true)
    int ancestryCount(Long head);
    @org.springframework.data.jpa.repository.Query("select coalesce(max(v.versionNumber),0)+1 from RouteVersion v where v.route.id=:routeId")
    int nextNumber(Long routeId);
    Optional<RouteVersion> findByRoute_PublicIdAndVersionNumber(String publicId,int versionNumber);
    @EntityGraph(attributePaths={"basedOnVersion","mergedSuggestion"})
    List<RouteVersion> findByRoute_PublicIdOrderByVersionNumberDesc(String publicId);
}
