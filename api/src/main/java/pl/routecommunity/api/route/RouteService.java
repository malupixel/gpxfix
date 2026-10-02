package pl.routecommunity.api.route;
import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import org.locationtech.jts.geom.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import pl.routecommunity.api.common.error.ApiException;
import pl.routecommunity.api.gpx.*;
import pl.routecommunity.api.storage.FileStorage;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class RouteService {
    private final RouteRepository routes;private final RouteVersionRepository versions;private final GpxParser parser;private final FileStorage storage;
    private final PublicIdGenerator ids;private final RouteMapper mapper;private final RouteOwnershipService ownership;private final long maxBytes;private final ObjectMapper json;private final RouteVersionPipeline pipeline;
    private final GeometryFactory geometries=new GeometryFactory(new PrecisionModel(),4326);
    public RouteService(RouteRepository routes,RouteVersionRepository versions,GpxParser parser,FileStorage storage,PublicIdGenerator ids,RouteMapper mapper,RouteOwnershipService ownership,@Value("${app.gpx.max-file-size-bytes}") long maxBytes,ObjectMapper json,RouteVersionPipeline pipeline){this.routes=routes;this.versions=versions;this.parser=parser;this.storage=storage;this.ids=ids;this.mapper=mapper;this.ownership=ownership;this.maxBytes=maxBytes;this.json=json;this.pipeline=pipeline;}

    @Transactional public CreatedRoute createDrawn(CreateDrawnRouteRequest request){
        var document=request==null?null:request.editorDocument();validateDocument(document);List<List<Double>> coordinates=new ArrayList<>();for(int i=0;i<document.segments().size();i++){var geometry=document.segments().get(i).geometry();coordinates.addAll(i==0?geometry:geometry.subList(1,geometry.size()));}
        String name=routeName(request.name(),"drawn-route.gpx");GpxTrack source=GpxParser.calculateMetrics(List.of(coordinates.stream().map(value->new GpxPoint(value.get(1),value.get(0),null)).toList()));RouteVersionPipeline.Prepared prepared=pipeline.prepare(name,source,null);String definition;try{definition=json.writeValueAsString(document);}catch(Exception e){throw new ApiException(HttpStatus.BAD_REQUEST,"Invalid editor document");}
        return persistNew(name,optional(request.description()),"drawn-route.gpx",prepared.gpx(),prepared.track(),"DRAWN",definition,RouteVersionSource.INITIAL_DRAWN);
    }
    @Transactional public CreatedRoute create(MultipartFile file,String requestedName,String description){
        if(file==null||file.isEmpty())throw new ApiException(HttpStatus.BAD_REQUEST,"A non-empty GPX file is required");if(file.getSize()>maxBytes)throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE,"The uploaded GPX file is too large");
        byte[] content;try{content=file.getBytes();}catch(IOException e){throw new ApiException(HttpStatus.BAD_REQUEST,"The uploaded GPX file could not be read");}GpxTrack track;try{track=parser.parse(content);}catch(InvalidGpxException e){throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,e.getMessage());}
        String name=routeName(requestedName,file.getOriginalFilename());RouteVersionPipeline.Prepared prepared=pipeline.prepare(name,track,content);return persistNew(name,optional(description),safeFilename(file.getOriginalFilename()),prepared.gpx(),prepared.track(),"GPX",null,RouteVersionSource.INITIAL_UPLOAD);
    }
    private CreatedRoute persistNew(String name,String description,String filename,byte[] content,GpxTrack track,String sourceType,String definition,RouteVersionSource source){
        String key=storage.store(content);try{Instant now=Instant.now();String publicId=uniquePublicId(),token=ownership.newSecret();Route route=routes.saveAndFlush(new Route(publicId,ownership.hash(token),now));RouteVersion version=versions.saveAndFlush(new RouteVersion(route,1,now,source,null,null,name,description,filename,key,track.distanceMeters(),track.elevationGainMeters(),geometry(track.points()),sourceType,definition));route.publish(version);routes.saveAndFlush(route);return new CreatedRoute(publicId,token,ownership.establish(publicId,token));}catch(RuntimeException e){storage.delete(key);throw e;}
    }
    @Transactional public byte[] download(String publicId,Integer versionNumber){RouteVersion version=resolve(publicId,versionNumber).version();return prepared(version).gpx();}
    @Transactional public RouteDto get(String publicId,Integer versionNumber){Resolved resolved=resolve(publicId,versionNumber);return mapper.toDto(resolved.route(),resolved.version(),prepared(resolved.version()).track());}
    @Transactional(readOnly=true) public List<RouteVersionSummaryDto> history(String publicId){Route route=routes.findByPublicId(publicId).orElseThrow(()->notFound("Route not found"));return versions.findByRoute_PublicIdOrderByVersionNumberDesc(publicId).stream().map(version->mapper.summary(route,version)).toList();}
    private Resolved resolve(String publicId,Integer versionNumber){Route route=routes.findByPublicId(publicId).orElseThrow(()->notFound("Route not found"));RouteVersion version=versionNumber==null?route.getCurrentVersion():versions.findByRoute_PublicIdAndVersionNumber(publicId,versionNumber).orElseThrow(()->notFound("Route version not found"));return new Resolved(route,version);}
    private RouteVersionPipeline.Prepared prepared(RouteVersion version){byte[] original=storage.load(version.getStorageKey());GpxTrack track=parser.parse(original);if(track.points().stream().allMatch(point->point.elevationMeters()!=null))return new RouteVersionPipeline.Prepared(track,original);RouteVersionPipeline.Prepared prepared=pipeline.prepare(version.getName(),track,original);String oldKey=version.getStorageKey(),newKey=storage.store(prepared.gpx());try{version.attachElevationData(newKey,prepared.track().elevationGainMeters());versions.saveAndFlush(version);}catch(RuntimeException failure){storage.delete(newKey);throw failure;}TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){storage.delete(oldKey);}});return prepared;}
    private record Resolved(Route route,RouteVersion version){}
    private ApiException notFound(String message){return new ApiException(HttpStatus.NOT_FOUND,message);}
    private void validateDocument(CreateDrawnRouteRequest.EditorDocument d){if(d==null||d.version()!=1||d.points()==null||d.segments()==null||d.points().size()<2||d.points().size()>10000||d.segments().size()!=d.points().size()-1)throw new ApiException(HttpStatus.BAD_REQUEST,"Invalid route editor document");Set<String> pointIds=new HashSet<>();for(var p:d.points()){if(p.id()==null||!pointIds.add(p.id())||!validCoordinate(p.coordinate()))throw new ApiException(HttpStatus.BAD_REQUEST,"Invalid control point");}for(int i=0;i<d.segments().size();i++){var s=d.segments().get(i);if(!Set.of("ROUTED","DIRECT").contains(s.mode())||!s.fromId().equals(d.points().get(i).id())||!s.toId().equals(d.points().get(i+1).id())||s.geometry()==null||s.geometry().size()<2||s.geometry().size()>20000||!s.geometry().stream().allMatch(this::validCoordinate)||!same(s.geometry().get(0),d.points().get(i).coordinate())||!same(s.geometry().get(s.geometry().size()-1),d.points().get(i+1).coordinate()))throw new ApiException(HttpStatus.BAD_REQUEST,"Invalid or discontinuous route segment");}}
    private boolean validCoordinate(List<Double> c){return c!=null&&c.size()==2&&c.get(0)!=null&&c.get(1)!=null&&Double.isFinite(c.get(0))&&Double.isFinite(c.get(1))&&c.get(0)>=-180&&c.get(0)<=180&&c.get(1)>=-90&&c.get(1)<=90;}
    private boolean same(List<Double>a,List<Double>b){return Math.abs(a.get(0)-b.get(0))<=1e-5&&Math.abs(a.get(1)-b.get(1))<=1e-5;}
    private LineString geometry(List<GpxPoint> points){return geometries.createLineString(points.stream().map(p->new Coordinate(p.longitude(),p.latitude())).toArray(Coordinate[]::new));}
    private String uniquePublicId(){for(int i=0;i<5;i++){String value=ids.next();if(!routes.existsByPublicId(value))return value;}throw new DataIntegrityViolationException("Could not allocate public ID");}
    private String routeName(String requested,String filename){String value=optional(requested);if(value!=null){if(value.length()>200)throw new ApiException(HttpStatus.BAD_REQUEST,"Route name must not exceed 200 characters");return value;}String safe=safeFilename(filename);int dot=safe.lastIndexOf('.');String fallback=dot>0?safe.substring(0,dot):safe;return fallback.isBlank()?"Untitled route":fallback.substring(0,Math.min(200,fallback.length()));}
    private String optional(String value){return value==null||value.isBlank()?null:value.trim();}private String safeFilename(String value){if(value==null||value.isBlank())return "upload.gpx";String safe=Path.of(value).getFileName().toString();return safe.substring(0,Math.min(255,safe.length()));}
}
