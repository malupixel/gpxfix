package pl.routecommunity.api.route;
import jakarta.persistence.*;
import java.time.Instant;
import org.locationtech.jts.geom.LineString;
@Entity
@Table(name = "routes")
class Route {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name="public_id", nullable=false, unique=true, length=12) private String publicId;
    @Column(nullable=false, length=200) private String name;
    @Column(columnDefinition="text") private String description;
    @Column(name="original_filename", nullable=false, length=255) private String originalFilename;
    @Column(name="storage_key", nullable=false, unique=true, length=255) private String storageKey;
    @Column(name="distance_meters", nullable=false) private double distanceMeters;
    @Column(name="elevation_gain_meters") private Double elevationGainMeters;
    @Column(name="track_geometry", nullable=false, columnDefinition="geometry(LineString,4326)") private LineString trackGeometry;
    @Column(name="created_at", nullable=false) private Instant createdAt;
    @Column(name="updated_at", nullable=false) private Instant updatedAt;
    protected Route() { }
    Route(String publicId, String name, String description, String originalFilename, String storageKey, double distanceMeters, Double elevationGainMeters, LineString trackGeometry, Instant now) {
        this.publicId=publicId; this.name=name; this.description=description; this.originalFilename=originalFilename; this.storageKey=storageKey;
        this.distanceMeters=distanceMeters; this.elevationGainMeters=elevationGainMeters; this.trackGeometry=trackGeometry; this.createdAt=now; this.updatedAt=now;
    }
    String getPublicId(){return publicId;} String getName(){return name;} String getDescription(){return description;}
    double getDistanceMeters(){return distanceMeters;} Double getElevationGainMeters(){return elevationGainMeters;}
    LineString getTrackGeometry(){return trackGeometry;} Instant getCreatedAt(){return createdAt;}
}
