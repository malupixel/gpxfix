package pl.routecommunity.api.route;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="route_branches")
class RouteBranch {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="route_id") private Route route;
    @Column(name="public_id",nullable=false,length=36) private String publicId;
    @Column(nullable=false,length=80) private String name;
    @Column(length=2000) private String description;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="fork_version_id") private RouteVersion forkVersion;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="current_version_id") private RouteVersion currentVersion;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    protected RouteBranch() { }
    RouteBranch(Route route,String publicId,String name,String description,RouteVersion fork) {
        this.route=route;this.publicId=publicId;this.name=name;this.description=description;
        this.forkVersion=fork;this.currentVersion=fork;this.createdAt=Instant.now();
    }
    Long getId(){return id;} String getPublicId(){return publicId;} String getName(){return name;}
    String getDescription(){return description;} RouteVersion getCurrentVersion(){return currentVersion;}
    RouteVersion getForkVersion(){return forkVersion;}
    void publish(RouteVersion version){currentVersion=version;}
}
