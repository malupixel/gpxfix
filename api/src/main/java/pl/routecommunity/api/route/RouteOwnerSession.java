package pl.routecommunity.api.route;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "route_owner_sessions")
class RouteOwnerSession {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "route_id") private Route route;
    @Column(name = "token_hash", nullable = false, unique = true, length = 32) private byte[] tokenHash;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected RouteOwnerSession() { }
    RouteOwnerSession(Route route, byte[] tokenHash, Instant expiresAt, Instant createdAt) {
        this.route = route; this.tokenHash = tokenHash; this.expiresAt = expiresAt; this.createdAt = createdAt;
    }
}
