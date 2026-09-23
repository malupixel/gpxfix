package pl.routecommunity.api.route;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import jakarta.servlet.http.HttpServletRequest;
@RestController
@RequestMapping("/api/routes")
public class RouteController {
    private final RouteService service; private final RouteOwnershipService ownership;
    public RouteController(RouteService service,RouteOwnershipService ownership){this.service=service;this.ownership=ownership;}
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<CreateRouteResponse> create(@RequestParam("file") MultipartFile file,@RequestParam(required=false) String name,@RequestParam(required=false) String description){
        CreatedRoute created=service.create(file,name,description);
        return ResponseEntity.status(HttpStatus.CREATED).header(HttpHeaders.SET_COOKIE,ownership.cookieHeader(created.publicId(),created.sessionToken())).body(created.response());
    }
    @GetMapping("/{publicId}") public RouteDto get(@PathVariable String publicId){return service.get(publicId);}
    @PostMapping("/{publicId}/ownership")
    public ResponseEntity<Void> establishOwnership(@PathVariable String publicId,@RequestBody ManagementTokenRequest request){
        String session=ownership.establish(publicId,request.token());
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE,ownership.cookieHeader(publicId,session)).build();
    }
    @GetMapping("/{publicId}/owner") public java.util.Map<String,Boolean> owner(@PathVariable String publicId,HttpServletRequest request){
        ownership.requireOwner(publicId,request); return java.util.Map.of("owner",true);
    }
    @GetMapping("/{publicId}/owner/access-token") public ResponseEntity<java.util.Map<String,String>> ownerAccessToken(@PathVariable String publicId,HttpServletRequest request){
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(java.util.Map.of("token",ownership.ownerSessionToken(publicId,request)));
    }
}
