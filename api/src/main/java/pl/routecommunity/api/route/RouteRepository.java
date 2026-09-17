package pl.routecommunity.api.route;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
interface RouteRepository extends JpaRepository<Route,Long> {
    Optional<Route> findByPublicId(String publicId);
    boolean existsByPublicId(String publicId);
}
