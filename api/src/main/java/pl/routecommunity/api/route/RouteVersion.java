package pl.routecommunity.api.route;

import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.locationtech.jts.geom.LineString;

@Entity
@Table(name="route_versions",uniqueConstraints=@UniqueConstraint(columnNames={"route_id","version_number"}))
class RouteVersion {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="route_id",nullable=false) private Route route;
    @Column(name="version_number",nullable=false) private int versionNumber;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=32) private RouteVersionSource source;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="based_on_version_id") private RouteVersion basedOnVersion;
    @OneToOne(fetch=FetchType.LAZY) @JoinColumn(name="merged_suggestion_id") private RouteSuggestion mergedSuggestion;
    @Column(nullable=false,length=200) private String name;
    @Column(columnDefinition="text") private String description;
    @Column(name="original_filename",nullable=false,length=255) private String originalFilename;
    @Column(name="storage_key",nullable=false,unique=true,length=255) private String storageKey;
    @Column(name="distance_meters",nullable=false) private double distanceMeters;
    @Column(name="elevation_gain_meters") private Double elevationGainMeters;
    @Column(name="track_geometry",nullable=false,columnDefinition="geometry(LineString,4326)") private LineString trackGeometry;
    @Column(name="source_type",nullable=false,length=20) private String sourceType;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="editor_definition",columnDefinition="jsonb") private String editorDefinition;
    protected RouteVersion() { }
    RouteVersion(Route route,int versionNumber,Instant createdAt,RouteVersionSource source,RouteVersion basedOnVersion,RouteSuggestion mergedSuggestion,
            String name,String description,String originalFilename,String storageKey,double distanceMeters,Double elevationGainMeters,LineString trackGeometry,String sourceType,String editorDefinition) {
        this.route=route;this.versionNumber=versionNumber;this.createdAt=createdAt;this.source=source;this.basedOnVersion=basedOnVersion;this.mergedSuggestion=mergedSuggestion;
        this.name=name;this.description=description;this.originalFilename=originalFilename;this.storageKey=storageKey;this.distanceMeters=distanceMeters;
        this.elevationGainMeters=elevationGainMeters;this.trackGeometry=trackGeometry;this.sourceType=sourceType;this.editorDefinition=editorDefinition;
    }
    Long getId(){return id;} Route getRoute(){return route;} int getVersionNumber(){return versionNumber;} Instant getCreatedAt(){return createdAt;}
    RouteVersionSource getSource(){return source;} RouteVersion getBasedOnVersion(){return basedOnVersion;} RouteSuggestion getMergedSuggestion(){return mergedSuggestion;}
    String getName(){return name;} String getDescription(){return description;} String getOriginalFilename(){return originalFilename;} String getStorageKey(){return storageKey;}
    double getDistanceMeters(){return distanceMeters;} Double getElevationGainMeters(){return elevationGainMeters;} LineString getTrackGeometry(){return trackGeometry;}
    String getSourceType(){return sourceType;} String getEditorDefinition(){return editorDefinition;}
    void attachElevationData(String storageKey,Double elevationGainMeters){this.storageKey=storageKey;this.elevationGainMeters=elevationGainMeters;}
}
