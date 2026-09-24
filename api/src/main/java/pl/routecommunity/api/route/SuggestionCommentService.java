package pl.routecommunity.api.route;

import java.time.Instant;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.routecommunity.api.common.error.ApiException;

@Service
public class SuggestionCommentService {
 private final RouteSuggestionRepository suggestions; private final SuggestionCommentRepository comments; private final PublicIdGenerator ids; private final RouteSuggestionService mapper;
 SuggestionCommentService(RouteSuggestionRepository suggestions,SuggestionCommentRepository comments,PublicIdGenerator ids,RouteSuggestionService mapper){this.suggestions=suggestions;this.comments=comments;this.ids=ids;this.mapper=mapper;}
 @Transactional public SuggestionCommentDto create(String routePublicId,String suggestionPublicId,CreateSuggestionCommentRequest request){
  RouteSuggestion suggestion=suggestions.findByRoute_PublicIdAndPublicId(routePublicId,suggestionPublicId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Suggestion not found"));
  if(!suggestion.acceptsComments())throw new ApiException(HttpStatus.CONFLICT,"Comments are allowed only on published, unmerged suggestions");
  SuggestionComment value=new SuggestionComment(uniqueId(),suggestion,request.authorName().trim(),request.content().trim(),Instant.now());comments.saveAndFlush(value);return mapper.commentDto(value);
 }
 @Transactional public SuggestionCommentDto moderate(String commentPublicId,ModerationStatus target){
  SuggestionComment value=comments.findByPublicId(commentPublicId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Comment not found"));
  try{value.moderate(target,Instant.now());}catch(IllegalArgumentException|IllegalStateException e){throw new ApiException(HttpStatus.BAD_REQUEST,e.getMessage());}return mapper.commentDto(value);
 }
 @Transactional(readOnly=true) String owningRoutePublicId(String commentPublicId){return comments.findByPublicId(commentPublicId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Comment not found")).getSuggestion().getRoute().getPublicId();}
 @Transactional(readOnly=true) List<ModerationQueueItemDto> pendingForRoute(String routePublicId){return comments.findBySuggestion_Route_PublicIdOrderByCreatedAtAsc(routePublicId).stream().filter(c->c.getModerationStatus()==ModerationStatus.PENDING).map(c->new ModerationQueueItemDto(ModerationQueueItemDto.Kind.COMMENT,c.getPublicId(),c.getSuggestion().getPublicId(),c.getSuggestion().getType(),c.getAuthorName(),c.getContent(),c.getCreatedAt())).toList();}
 private String uniqueId(){for(int i=0;i<5;i++){String id=ids.next();if(!comments.existsByPublicId(id))return id;}throw new DataIntegrityViolationException("Could not allocate comment public ID");}
}
