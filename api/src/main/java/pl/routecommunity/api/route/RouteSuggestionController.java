package pl.routecommunity.api.route;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/routes/{routePublicId}/suggestions")
public class RouteSuggestionController {
    private final RouteSuggestionService service;
    RouteSuggestionController(RouteSuggestionService service){this.service=service;}
    @GetMapping public List<SuggestionDto> list(@PathVariable String routePublicId){return service.list(routePublicId);}
    @PostMapping public ResponseEntity<SuggestionDto> create(@PathVariable String routePublicId,@Valid @RequestBody CreateSuggestionRequest request){
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(routePublicId,request));
    }
}
