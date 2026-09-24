package pl.routecommunity.api.route;

import java.time.Instant;
import java.util.*;
import org.locationtech.jts.geom.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.routecommunity.api.common.error.ApiException;

@Service
public class RouteSuggestionService {
    private static final double ANCHOR_TOLERANCE_DEGREES=0.00002;
    private static final Set<String> NOTE_CATEGORIES=Set.of("water","food","surface","view","services","other");
    private static final Set<String> PROBLEM_CATEGORIES=Set.of("highTraffic","badSurface","roadClosed","construction","dangerous","unpaved","other");
    private static final Set<String> DETOUR_TAGS=Set.of("betterSurface","lessTraffic","safer","scenic","avoidsClosure","other");
    private final RouteRepository routes; private final RouteSuggestionRepository suggestions; private final SuggestionCommentRepository comments; private final PublicIdGenerator ids;
    private final GeometryFactory geometries=new GeometryFactory(new PrecisionModel(),4326);
    RouteSuggestionService(RouteRepository routes,RouteSuggestionRepository suggestions,SuggestionCommentRepository comments,PublicIdGenerator ids){this.routes=routes;this.suggestions=suggestions;this.comments=comments;this.ids=ids;}

    @Transactional
    public SuggestionDto create(String routePublicId,CreateSuggestionRequest request){
        Route route=routes.findByPublicId(routePublicId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Route not found"));
        validateFinite(request.start());
        Point start=point(request.start());
        requireOnRoute(route,start,"Start anchor");
        if(request.start().distanceMeters()>route.getDistanceMeters()+1) throw bad("Start distance exceeds route length");
        Point end=null; LineString proposed=null; Double endDistance=null;
        if(request.type()==SuggestionType.NOTE){
            if(request.end()!=null||request.proposedGeometry()!=null)throw bad("NOTE accepts only one route anchor");
            validateOptional(request.category(),NOTE_CATEGORIES,"note category");
            if(request.tags()!=null&&!request.tags().isEmpty())throw bad("NOTE does not accept tags");
        } else {
            if(request.end()==null)throw bad(request.type()+" requires an end anchor");
            validateFinite(request.end()); end=point(request.end()); requireOnRoute(route,end,"End anchor"); endDistance=request.end().distanceMeters();
            if(endDistance>route.getDistanceMeters()+1||endDistance<=request.start().distanceMeters())throw bad("End distance must be after the start and within the route");
            if(request.type()==SuggestionType.PROBLEM){
                if(request.proposedGeometry()!=null)throw bad("PROBLEM does not accept proposed geometry");
                validateRequired(request.category(),PROBLEM_CATEGORIES,"problem category");
                if(request.tags()!=null&&!request.tags().isEmpty())throw bad("PROBLEM does not accept tags");
            } else {
                if(request.category()!=null&&!request.category().isBlank())throw bad("DETOUR does not accept a category");
                validateTags(request.tags()); proposed=line(request.proposedGeometry());
                if(!proposed.isValid()||!proposed.isSimple()||proposed.getLength()==0)throw bad("Detour geometry must be a valid, non-self-intersecting LineString");
                if(proposed.getStartPoint().distance(start)>ANCHOR_TOLERANCE_DEGREES||proposed.getEndPoint().distance(end)>ANCHOR_TOLERANCE_DEGREES)
                    throw bad("Detour geometry must start and end at its route anchors");
            }
        }
        String publicId=uniquePublicId(); Instant now=Instant.now();
        RouteSuggestion entity=new RouteSuggestion(publicId,route,request.type(),request.authorName().trim(),request.description().trim(),optional(request.category()),
                request.tags()==null?null:String.join(",",request.tags()),start,end,proposed,request.start().distanceMeters(),endDistance,now);
        suggestions.saveAndFlush(entity); return dto(entity,false);
    }

    @Transactional(readOnly=true)
    public List<SuggestionDto> listPublic(String routePublicId){
        if(!routes.existsByPublicId(routePublicId))throw new ApiException(HttpStatus.NOT_FOUND,"Route not found");
        return suggestions.findByRoute_PublicIdAndModerationStatusOrderByStartDistanceMetersAscCreatedAtAsc(routePublicId,ModerationStatus.PUBLISHED).stream().map(value->dto(value,false)).toList();
    }
    @Transactional(readOnly=true)
    public SuggestionDto getPublic(String routePublicId,String suggestionPublicId){return dto(suggestions.findByRoute_PublicIdAndPublicIdAndModerationStatus(routePublicId,suggestionPublicId,ModerationStatus.PUBLISHED).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Suggestion not found")),false);}
    @Transactional(readOnly=true)
    public List<SuggestionDto> listOwner(String routePublicId){return suggestions.findByRoute_PublicIdOrderByCreatedAtAsc(routePublicId).stream().map(value->dto(value,true)).toList();}
    @Transactional(readOnly=true)
    List<RouteSuggestion> pendingForRoute(String routePublicId){return suggestions.findByRoute_PublicIdOrderByCreatedAtAsc(routePublicId).stream().filter(s->s.getModerationStatus()==ModerationStatus.PENDING).toList();}
    @Transactional
    public SuggestionDto moderate(String routePublicId,String suggestionPublicId,ModerationStatus target){
        RouteSuggestion value=suggestions.findByRoute_PublicIdAndPublicId(routePublicId,suggestionPublicId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Suggestion not found"));
        try{value.moderate(target,Instant.now());}catch(IllegalArgumentException|IllegalStateException e){throw bad(e.getMessage());}
        return dto(value,true);
    }
    private void requireOnRoute(Route route,Point point,String label){if(route.getTrackGeometry().distance(point)>ANCHOR_TOLERANCE_DEGREES)throw bad(label+" must lie on the route");}
    private void validateFinite(CreateSuggestionRequest.Anchor anchor){if(!Double.isFinite(anchor.longitude())||!Double.isFinite(anchor.latitude())||!Double.isFinite(anchor.distanceMeters()))throw bad("Coordinates and route distance must be finite");}
    private Point point(CreateSuggestionRequest.Anchor anchor){return geometries.createPoint(new Coordinate(anchor.longitude(),anchor.latitude()));}
    private LineString line(CreateSuggestionRequest.LineStringGeometry value){
        if(value==null||!"LineString".equals(value.type()))throw bad("DETOUR requires a GeoJSON LineString");
        Coordinate[] coordinates=new Coordinate[value.coordinates().size()];
        for(int i=0;i<coordinates.length;i++){List<Double> pair=value.coordinates().get(i);double lng=pair.get(0),lat=pair.get(1);if(!Double.isFinite(lng)||!Double.isFinite(lat)||lng< -180||lng>180||lat< -90||lat>90)throw bad("Detour contains invalid WGS84 coordinates");coordinates[i]=new Coordinate(lng,lat);}
        return geometries.createLineString(coordinates);
    }
    private void validateOptional(String value,Set<String> allowed,String label){if(value!=null&&!value.isBlank()&&!allowed.contains(value))throw bad("Unsupported "+label);}
    private void validateRequired(String value,Set<String> allowed,String label){if(value==null||!allowed.contains(value))throw bad("Unsupported or missing "+label);}
    private void validateTags(List<String> tags){if(tags!=null&&(new HashSet<>(tags).size()!=tags.size()||!DETOUR_TAGS.containsAll(tags)))throw bad("Unsupported or duplicate detour tag");}
    private String optional(String value){return value==null||value.isBlank()?null:value.trim();}
    private String uniquePublicId(){for(int i=0;i<5;i++){String id=ids.next();if(!suggestions.existsByPublicId(id))return id;}throw new DataIntegrityViolationException("Could not allocate suggestion public ID");}
    private ApiException bad(String message){return new ApiException(HttpStatus.BAD_REQUEST,message);}
    SuggestionDto dto(RouteSuggestion value,boolean owner){
        SuggestionDto.Anchor start=new SuggestionDto.Anchor(value.getStartPoint().getX(),value.getStartPoint().getY(),value.getStartDistanceMeters());
        SuggestionDto.Anchor end=value.getEndPoint()==null?null:new SuggestionDto.Anchor(value.getEndPoint().getX(),value.getEndPoint().getY(),value.getEndDistanceMeters());
        SuggestionDto.GeoJsonLineString geometry=value.getProposedGeometry()==null?null:new SuggestionDto.GeoJsonLineString("LineString",Arrays.stream(value.getProposedGeometry().getCoordinates()).map(c->List.of(c.x,c.y)).toList());
        List<String> tags=value.getTags()==null||value.getTags().isBlank()?List.of():List.of(value.getTags().split(","));
        List<SuggestionCommentDto> discussion=(owner
                ? comments.findBySuggestion_IdOrderByCreatedAtAsc(value.getId()).stream()
                : comments.findBySuggestion_IdAndModerationStatusOrderByCreatedAtAsc(value.getId(),ModerationStatus.PUBLISHED).stream()).map(this::commentDto).toList();
        long count=comments.countBySuggestion_IdAndModerationStatus(value.getId(),ModerationStatus.PUBLISHED);
        return new SuggestionDto(value.getPublicId(),value.getType(),value.getModerationStatus(),value.getIntegrationStatus(),value.getApplicability(),value.getAuthorName(),value.getDescription(),value.getCategory(),tags,start,end,geometry,value.getBaseRouteUpdatedAt(),value.getCreatedAt(),value.getUpdatedAt(),count,discussion);
    }
    SuggestionCommentDto commentDto(SuggestionComment value){return new SuggestionCommentDto(value.getPublicId(),value.getAuthorName(),value.getContent(),value.getModerationStatus(),value.getCreatedAt(),value.getUpdatedAt());}
}
