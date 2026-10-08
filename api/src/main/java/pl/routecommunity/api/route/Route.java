package pl.routecommunity.api.route;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="routes")
class Route {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="public_id",nullable=false,unique=true,length=12) private String publicId;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    @Column(name="owner_token_hash",length=32) private byte[] ownerTokenHash;
    @OneToOne(fetch=FetchType.LAZY) @JoinColumn(name="current_version_id",unique=true) private RouteVersion currentVersion;
    @Column(nullable=false,length=200) private String name;
    @Column(columnDefinition="text") private String description;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;
    @Column(name="suggestions_enabled",nullable=false) private boolean suggestionsEnabled=true;
    @Column(name="deleted_at") private Instant deletedAt;
    @Column(name="original_upload_storage_key",length=255) private String originalUploadStorageKey;
    @Column(name="original_upload_filename",length=255) private String originalUploadFilename;
    protected Route() { }
    Route(String publicId,byte[] ownerTokenHash,Instant now){this.publicId=publicId;this.ownerTokenHash=ownerTokenHash;this.createdAt=now;this.updatedAt=now;}
    void publish(RouteVersion version){if(version.getRoute()!=this)throw new IllegalArgumentException("Version belongs to another route");this.currentVersion=version;this.updatedAt=version.getCreatedAt().truncatedTo(java.time.temporal.ChronoUnit.MICROS);}
    void metadata(String name,String description,Instant at){this.name=name;this.description=description;this.updatedAt=at.truncatedTo(java.time.temporal.ChronoUnit.MICROS);}
    void suggestions(boolean enabled,Instant at){this.suggestionsEnabled=enabled;this.updatedAt=at.truncatedTo(java.time.temporal.ChronoUnit.MICROS);}
    void delete(Instant at){this.deletedAt=at;this.updatedAt=at.truncatedTo(java.time.temporal.ChronoUnit.MICROS);}
    void original(String key,String filename){this.originalUploadStorageKey=key;this.originalUploadFilename=filename;}
    String getName(){return name;} String getDescription(){return description;} Instant getUpdatedAt(){return updatedAt;}
    boolean isSuggestionsEnabled(){return suggestionsEnabled;} String getOriginalUploadStorageKey(){return originalUploadStorageKey;}
    String getOriginalUploadFilename(){return originalUploadFilename;}
    Long getId(){return id;} String getPublicId(){return publicId;} Instant getCreatedAt(){return createdAt;} byte[] getOwnerTokenHash(){return ownerTokenHash;}
    RouteVersion getCurrentVersion(){if(currentVersion==null)throw new IllegalStateException("Route has no current version");return currentVersion;}
}
