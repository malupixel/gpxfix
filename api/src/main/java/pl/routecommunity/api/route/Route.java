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
    protected Route() { }
    Route(String publicId,byte[] ownerTokenHash,Instant now){this.publicId=publicId;this.ownerTokenHash=ownerTokenHash;this.createdAt=now;}
    void publish(RouteVersion version){if(version.getRoute()!=this)throw new IllegalArgumentException("Version belongs to another route");this.currentVersion=version;}
    Long getId(){return id;} String getPublicId(){return publicId;} Instant getCreatedAt(){return createdAt;} byte[] getOwnerTokenHash(){return ownerTokenHash;}
    RouteVersion getCurrentVersion(){if(currentVersion==null)throw new IllegalStateException("Route has no current version");return currentVersion;}
}
