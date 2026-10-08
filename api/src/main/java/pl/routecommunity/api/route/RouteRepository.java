package pl.routecommunity.api.route;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
interface RouteRepository extends JpaRepository<Route,Long> {
    @Query("select r from Route r where r.publicId=:publicId and r.deletedAt is null")
    Optional<Route> findByPublicId(String publicId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Route r where r.publicId=:publicId and r.deletedAt is null")
    Optional<Route> findLockedByPublicId(String publicId);
    boolean existsByPublicId(String publicId);
}
