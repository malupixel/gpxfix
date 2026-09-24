package pl.routecommunity.api.route;

import jakarta.persistence.*;
import java.time.Instant;
import org.locationtech.jts.geom.LineString;
import org.locationtech.jts.geom.Point;

@Entity
@Table(name="route_suggestions")
class RouteSuggestion {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="public_id",nullable=false,unique=true,length=12) private String publicId;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="route_id",nullable=false) private Route route;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=16) private SuggestionType type;
    @Enumerated(EnumType.STRING) @Column(name="moderation_status",nullable=false,length=16) private ModerationStatus moderationStatus;
    @Enumerated(EnumType.STRING) @Column(name="integration_status",nullable=false,length=24) private SuggestionIntegrationStatus integrationStatus;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=24) private SuggestionApplicability applicability;
    @Column(name="author_name",nullable=false,length=80) private String authorName;
    @Column(nullable=false,length=2000) private String description;
    @Column(length=40) private String category;
    @Column(length=300) private String tags;
    @Column(name="start_point",nullable=false,columnDefinition="geometry(Point,4326)") private Point startPoint;
    @Column(name="end_point",columnDefinition="geometry(Point,4326)") private Point endPoint;
    @Column(name="proposed_geometry",columnDefinition="geometry(LineString,4326)") private LineString proposedGeometry;
    @Column(name="start_distance_meters",nullable=false) private double startDistanceMeters;
    @Column(name="end_distance_meters") private Double endDistanceMeters;
    @Column(name="base_route_updated_at",nullable=false) private Instant baseRouteUpdatedAt;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;

    protected RouteSuggestion() { }
    RouteSuggestion(String publicId,Route route,SuggestionType type,String authorName,String description,String category,String tags,
            Point startPoint,Point endPoint,LineString proposedGeometry,double startDistanceMeters,Double endDistanceMeters,Instant now) {
        this.publicId=publicId;this.route=route;this.type=type;this.moderationStatus=ModerationStatus.PENDING;this.authorName=authorName;
        this.integrationStatus=type==SuggestionType.DETOUR?SuggestionIntegrationStatus.NOT_MERGED:SuggestionIntegrationStatus.NOT_APPLICABLE;
        this.applicability=type==SuggestionType.DETOUR?SuggestionApplicability.CLEAN:SuggestionApplicability.NOT_APPLICABLE;
        this.description=description;this.category=category;this.tags=tags;this.startPoint=startPoint;this.endPoint=endPoint;
        this.proposedGeometry=proposedGeometry;this.startDistanceMeters=startDistanceMeters;this.endDistanceMeters=endDistanceMeters;
        this.baseRouteUpdatedAt=route.getUpdatedAt();this.createdAt=now;this.updatedAt=now;
    }
    void moderate(ModerationStatus target,Instant now){moderationStatus.requirePending();if(target==ModerationStatus.PENDING)throw new IllegalArgumentException("Moderation must publish or reject");moderationStatus=target;updatedAt=now;}
    boolean acceptsComments(){return moderationStatus==ModerationStatus.PUBLISHED&&integrationStatus!=SuggestionIntegrationStatus.MERGED;}
    Route getRoute(){return route;} Long getId(){return id;} String getPublicId(){return publicId;} SuggestionType getType(){return type;} ModerationStatus getModerationStatus(){return moderationStatus;}
    SuggestionIntegrationStatus getIntegrationStatus(){return integrationStatus;} SuggestionApplicability getApplicability(){return applicability;}
    String getAuthorName(){return authorName;} String getDescription(){return description;} String getCategory(){return category;} String getTags(){return tags;}
    Point getStartPoint(){return startPoint;} Point getEndPoint(){return endPoint;} LineString getProposedGeometry(){return proposedGeometry;}
    double getStartDistanceMeters(){return startDistanceMeters;} Double getEndDistanceMeters(){return endDistanceMeters;}
    Instant getBaseRouteUpdatedAt(){return baseRouteUpdatedAt;} Instant getCreatedAt(){return createdAt;} Instant getUpdatedAt(){return updatedAt;}
}
