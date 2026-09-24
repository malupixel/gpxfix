package pl.routecommunity.api.route;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
interface SuggestionCommentRepository extends JpaRepository<SuggestionComment,Long>{
 boolean existsByPublicId(String id);
 List<SuggestionComment> findBySuggestion_IdAndModerationStatusOrderByCreatedAtAsc(Long id,ModerationStatus status);
 List<SuggestionComment> findBySuggestion_IdOrderByCreatedAtAsc(Long id);
 List<SuggestionComment> findBySuggestion_Route_PublicIdOrderByCreatedAtAsc(String routePublicId);
 Optional<SuggestionComment> findByPublicId(String id);
 long countBySuggestion_IdAndModerationStatus(Long id,ModerationStatus status);
}
