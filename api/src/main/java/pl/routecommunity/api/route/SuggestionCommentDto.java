package pl.routecommunity.api.route;
import java.time.Instant;
public record SuggestionCommentDto(String publicId,String authorName,String content,ModerationStatus moderationStatus,Instant createdAt,Instant updatedAt) { }
