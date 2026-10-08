package pl.routecommunity.api.route;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import jakarta.servlet.http.HttpServletRequest;
@RestController
@RequestMapping("/api/routes")
public class RouteController {
    private final RouteService service; private final RouteOwnershipService ownership; private final GpxExportService exports;
    public RouteController(RouteService service,RouteOwnershipService ownership,GpxExportService exports){this.service=service;this.ownership=ownership;this.exports=exports;}
    @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<CreateRouteResponse> create(@RequestParam("file") MultipartFile file,@RequestParam(required=false) String name,@RequestParam(required=false) String description){
        CreatedRoute created=service.create(file,name,description);
        return ResponseEntity.status(HttpStatus.CREATED).header(HttpHeaders.SET_COOKIE,ownership.cookieHeader(created.publicId(),created.sessionToken())).body(created.response());
    }
    @PostMapping(value="/drawn",consumes=MediaType.APPLICATION_JSON_VALUE) @ResponseStatus(HttpStatus.CREATED)
    public ResponseEntity<CreateRouteResponse> createDrawn(@RequestBody CreateDrawnRouteRequest request){CreatedRoute created=service.createDrawn(request);return ResponseEntity.status(HttpStatus.CREATED).header(HttpHeaders.SET_COOKIE,ownership.cookieHeader(created.publicId(),created.sessionToken())).body(created.response());}
    @GetMapping(value="/{publicId}/gpx",produces="application/gpx+xml") public ResponseEntity<byte[]> download(@PathVariable String publicId,@RequestParam(defaultValue="true") boolean elevation,@RequestParam(required=false) String filename){return downloadResponse(exports.export(publicId,null,elevation,filename));}
    @GetMapping("/{publicId}") public RouteDto get(@PathVariable String publicId){return service.get(publicId,null);}
    @GetMapping("/{publicId}/versions/{versionNumber}") public RouteDto getVersion(@PathVariable String publicId,@PathVariable int versionNumber){return service.get(publicId,versionNumber);}
    @GetMapping("/{publicId}/versions") public java.util.List<RouteVersionSummaryDto> history(@PathVariable String publicId){return service.history(publicId);}
    @GetMapping(value="/{publicId}/versions/{versionNumber}/gpx",produces="application/gpx+xml") public ResponseEntity<byte[]> downloadVersion(@PathVariable String publicId,@PathVariable int versionNumber,@RequestParam(defaultValue="true") boolean elevation,@RequestParam(required=false) String filename){return downloadResponse(exports.export(publicId,versionNumber,elevation,filename));}
    @GetMapping(value="/{publicId}/gpx/original",produces="application/gpx+xml") public ResponseEntity<byte[]> original(@PathVariable String publicId){return downloadResponse(exports.original(publicId));}
    private ResponseEntity<byte[]> downloadResponse(GpxExportService.Export exported){return ResponseEntity.ok().cacheControl(CacheControl.noStore())
        .header(HttpHeaders.CONTENT_DISPOSITION,ContentDisposition.attachment().filename(exported.filename(),java.nio.charset.StandardCharsets.UTF_8).build().toString())
        .header("X-Elevation-Available",Boolean.toString(exported.elevationAvailable())).body(exported.bytes());}
    @PostMapping("/{publicId}/ownership")
    public ResponseEntity<Void> establishOwnership(@PathVariable String publicId,@RequestBody ManagementTokenRequest request){
        String session=ownership.establish(publicId,request.token());
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE,ownership.cookieHeader(publicId,session)).build();
    }
    @GetMapping("/{publicId}/owner") public java.util.Map<String,Boolean> owner(@PathVariable String publicId,HttpServletRequest request){
        ownership.requireOwner(publicId,request); return java.util.Map.of("owner",true);
    }
    @GetMapping("/{publicId}/owner/editor") public ResponseEntity<OwnerEditorDto> ownerEditor(@PathVariable String publicId,HttpServletRequest request){
        ownership.requireOwner(publicId,request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.ownerEditor(publicId));
    }
    @PostMapping("/{publicId}/owner/versions") public ResponseEntity<RouteDto> ownerEdit(@PathVariable String publicId,
            @jakarta.validation.Valid @RequestBody OwnerEditRouteRequest body,HttpServletRequest request){
        ownership.requireOwner(publicId,request);
        return ResponseEntity.status(HttpStatus.CREATED).body(service.ownerEdit(publicId,body));
    }
    @GetMapping("/{publicId}/owner/access-token") public ResponseEntity<java.util.Map<String,String>> ownerAccessToken(@PathVariable String publicId,HttpServletRequest request){
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(java.util.Map.of("token",ownership.ownerSessionToken(publicId,request)));
    }
}
