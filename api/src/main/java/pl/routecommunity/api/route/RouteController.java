package pl.routecommunity.api.route;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
@RestController
@RequestMapping("/api/routes")
public class RouteController {
    private final RouteService service;
    public RouteController(RouteService service){this.service=service;}
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED)
    public CreateRouteResponse create(@RequestParam("file") MultipartFile file,@RequestParam(required=false) String name,@RequestParam(required=false) String description){return service.create(file,name,description);}
    @GetMapping("/{publicId}") public RouteDto get(@PathVariable String publicId){return service.get(publicId);}
}
