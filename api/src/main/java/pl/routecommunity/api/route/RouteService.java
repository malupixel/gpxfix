package pl.routecommunity.api.route;
import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.LineString;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import pl.routecommunity.api.common.error.ApiException;
import pl.routecommunity.api.gpx.*;
import pl.routecommunity.api.storage.FileStorage;
@Service
public class RouteService {
    private final RouteRepository repository; private final GpxParser parser; private final FileStorage storage;
    private final PublicIdGenerator ids; private final RouteMapper mapper; private final RouteOwnershipService ownership; private final long maxBytes;
    private final GeometryFactory geometries=new GeometryFactory(new PrecisionModel(),4326);
    public RouteService(RouteRepository repository,GpxParser parser,FileStorage storage,PublicIdGenerator ids,RouteMapper mapper,RouteOwnershipService ownership,@Value("${app.gpx.max-file-size-bytes}") long maxBytes){
        this.repository=repository;this.parser=parser;this.storage=storage;this.ids=ids;this.mapper=mapper;this.ownership=ownership;this.maxBytes=maxBytes;
    }
    @Transactional
    public CreatedRoute create(MultipartFile file,String requestedName,String description){
        if(file==null||file.isEmpty())throw new ApiException(HttpStatus.BAD_REQUEST,"A non-empty GPX file is required");
        if(file.getSize()>maxBytes)throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE,"The uploaded GPX file is too large");
        byte[] content; try{content=file.getBytes();}catch(IOException e){throw new ApiException(HttpStatus.BAD_REQUEST,"The uploaded GPX file could not be read");}
        GpxTrack track; try{track=parser.parse(content);}catch(InvalidGpxException e){throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,e.getMessage());}
        String key=storage.store(content);
        try{
            String publicId=uniquePublicId();
            String managementToken=ownership.newSecret();
            Route route=new Route(publicId,routeName(requestedName,file.getOriginalFilename()),optional(description),safeFilename(file.getOriginalFilename()),key,
                    track.distanceMeters(),track.elevationGainMeters(),geometry(track.points()),ownership.hash(managementToken),Instant.now());
            repository.saveAndFlush(route);
            return new CreatedRoute(publicId,managementToken,ownership.establish(publicId,managementToken));
        }catch(RuntimeException e){storage.delete(key);throw e;}
    }
    @Transactional(readOnly=true)
    public RouteDto get(String publicId){return repository.findByPublicId(publicId).map(route->mapper.toDto(route,parser.parse(storage.load(route.getStorageKey())))).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Route not found"));}
    private String uniquePublicId(){for(int i=0;i<5;i++){String id=ids.next();if(!repository.existsByPublicId(id))return id;}throw new DataIntegrityViolationException("Could not allocate public ID");}
    private LineString geometry(List<GpxPoint> points){Coordinate[] cs=points.stream().map(p->new Coordinate(p.longitude(),p.latitude())).toArray(Coordinate[]::new);return geometries.createLineString(cs);}
    private String routeName(String requested,String filename){String value=optional(requested);if(value!=null){if(value.length()>200)throw new ApiException(HttpStatus.BAD_REQUEST,"Route name must not exceed 200 characters");return value;}String safe=safeFilename(filename);int dot=safe.lastIndexOf('.');String fallback=dot>0?safe.substring(0,dot):safe;return fallback.isBlank()?"Untitled route":fallback.substring(0,Math.min(200,fallback.length()));}
    private String optional(String value){return value==null||value.isBlank()?null:value.trim();}
    private String safeFilename(String value){if(value==null||value.isBlank())return "upload.gpx";String safe=Path.of(value).getFileName().toString();return safe.substring(0,Math.min(255,safe.length()));}
}
