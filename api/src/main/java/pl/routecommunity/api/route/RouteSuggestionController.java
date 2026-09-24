package pl.routecommunity.api.route;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/routes/{routePublicId}/suggestions")
public class RouteSuggestionController {
    private final RouteSuggestionService service; private final SuggestionCommentService commentService; private final RouteOwnershipService ownership;
    RouteSuggestionController(RouteSuggestionService service,SuggestionCommentService commentService,RouteOwnershipService ownership){this.service=service;this.commentService=commentService;this.ownership=ownership;}
    @GetMapping public List<SuggestionDto> list(@PathVariable String routePublicId){return service.listPublic(routePublicId);}
    @GetMapping("/{suggestionPublicId}") public SuggestionDto get(@PathVariable String routePublicId,@PathVariable String suggestionPublicId){return service.getPublic(routePublicId,suggestionPublicId);}
    @PostMapping public ResponseEntity<SuggestionDto> create(@PathVariable String routePublicId,@Valid @RequestBody CreateSuggestionRequest request){
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(routePublicId,request));
    }
    @PostMapping("/{suggestionPublicId}/comments") public ResponseEntity<SuggestionCommentDto> comment(@PathVariable String routePublicId,@PathVariable String suggestionPublicId,@Valid @RequestBody CreateSuggestionCommentRequest request){return ResponseEntity.status(HttpStatus.CREATED).body(commentService.create(routePublicId,suggestionPublicId,request));}
    @GetMapping("/owner") public List<SuggestionDto> ownerList(@PathVariable String routePublicId,HttpServletRequest request){ownership.requireOwner(routePublicId,request);return service.listOwner(routePublicId);}
    @GetMapping("/owner/moderation-queue") public List<ModerationQueueItemDto> moderationQueue(@PathVariable String routePublicId,HttpServletRequest request){
      ownership.requireOwner(routePublicId,request);
      var suggestionItems=service.pendingForRoute(routePublicId).stream().map(s->new ModerationQueueItemDto(ModerationQueueItemDto.Kind.SUGGESTION,s.getPublicId(),s.getPublicId(),s.getType(),s.getAuthorName(),s.getDescription(),s.getCreatedAt()));
      var commentItems=commentService.pendingForRoute(routePublicId).stream();
      return java.util.stream.Stream.concat(suggestionItems,commentItems).sorted(java.util.Comparator.comparing(ModerationQueueItemDto::createdAt)).toList();
    }
    @PatchMapping("/owner/{suggestionPublicId}/moderation") public SuggestionDto moderate(@PathVariable String routePublicId,@PathVariable String suggestionPublicId,@Valid @RequestBody ModerationRequest body,HttpServletRequest request){ownership.requireOwner(routePublicId,request);return service.moderate(routePublicId,suggestionPublicId,body.moderationStatus());}
    @PatchMapping("/owner/comments/{commentPublicId}/moderation") public SuggestionCommentDto moderateComment(@PathVariable String routePublicId,@PathVariable String commentPublicId,@Valid @RequestBody ModerationRequest body,HttpServletRequest request){
      ownership.requireOwner(routePublicId,request);if(!commentService.owningRoutePublicId(commentPublicId).equals(routePublicId))throw new pl.routecommunity.api.common.error.ApiException(HttpStatus.NOT_FOUND,"Comment not found");return commentService.moderate(commentPublicId,body.moderationStatus());
    }
}
