package pl.routecommunity.api.route;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/routes/{publicId}")
class RouteBranchController {
    private final RouteBranches branches;
    private final RouteService routes;
    private final RouteOwnershipService ownership;
    RouteBranchController(RouteBranches branches,RouteService routes,RouteOwnershipService ownership){this.branches=branches;this.routes=routes;this.ownership=ownership;}
    record CreateBranch(@Positive int versionNumber,@NotBlank @Size(max=80) String name,@Size(max=2000) String description) { }
    record Copy(@NotBlank @Size(max=200) String name,@Size(max=2000) String description) { }
    record Label(@Size(max=80) String label) { }
    @GetMapping("/branches") List<RouteBranches.Dto> list(@PathVariable String publicId){return branches.list(publicId);}
    @PostMapping("/owner/branches") @ResponseStatus(HttpStatus.CREATED)
    RouteBranches.Dto create(@PathVariable String publicId,@Valid @RequestBody CreateBranch body,HttpServletRequest request){
        ownership.requireOwner(publicId,request);return branches.create(publicId,body.versionNumber(),body.name(),body.description());
    }
    @PatchMapping("/owner/versions/{versionNumber}/label") @ResponseStatus(HttpStatus.NO_CONTENT)
    void label(@PathVariable String publicId,@PathVariable int versionNumber,@Valid @RequestBody Label body,HttpServletRequest request){
        ownership.requireOwner(publicId,request);branches.label(publicId,versionNumber,body.label());
    }
    @PostMapping("/versions/{versionNumber}/copy")
    ResponseEntity<CreateRouteResponse> copy(@PathVariable String publicId,@PathVariable int versionNumber,@Valid @RequestBody Copy body){
        CreatedRoute created=routes.copy(publicId,versionNumber,body.name(),body.description());
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore())
            .header(HttpHeaders.SET_COOKIE,ownership.cookieHeader(created.publicId(),created.sessionToken())).body(created.response());
    }
}
