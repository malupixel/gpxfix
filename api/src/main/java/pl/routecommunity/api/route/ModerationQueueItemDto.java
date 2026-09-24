package pl.routecommunity.api.route;
import java.time.Instant;
public record ModerationQueueItemDto(Kind kind,String publicId,String suggestionPublicId,SuggestionType suggestionType,String authorName,String content,Instant createdAt){public enum Kind{SUGGESTION,COMMENT}}
