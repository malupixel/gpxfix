package pl.routecommunity.api.route;
import java.util.*;
import org.springframework.data.jpa.repository.*;
interface RouteBranchRepository extends JpaRepository<RouteBranch,Long> {
    Optional<RouteBranch> findByRoute_IdAndPublicId(Long routeId,String publicId);
    @EntityGraph(attributePaths={"currentVersion","forkVersion"})
    List<RouteBranch> findByRoute_IdOrderByIdAsc(Long routeId);
}
