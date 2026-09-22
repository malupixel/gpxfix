package pl.routecommunity.api.route;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface RouteOwnerSessionRepository extends JpaRepository<RouteOwnerSession, Long> {
    Optional<RouteOwnerSession> findByRoute_PublicIdAndTokenHashAndExpiresAtAfter(String publicId, byte[] tokenHash, Instant now);
}
