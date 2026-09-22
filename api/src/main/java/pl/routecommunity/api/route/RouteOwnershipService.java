package pl.routecommunity.api.route;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.routecommunity.api.common.error.ApiException;

@Service
public class RouteOwnershipService {
    static final String COOKIE_NAME = "route_owner";
    private final RouteRepository routes;
    private final RouteOwnerSessionRepository sessions;
    private final SecureRandom random = new SecureRandom();
    private final boolean secureCookie;
    private final Duration sessionLifetime;

    RouteOwnershipService(RouteRepository routes, RouteOwnerSessionRepository sessions,
            @Value("${app.ownership.cookie-secure:true}") boolean secureCookie,
            @Value("${app.ownership.session-days:30}") long sessionDays) {
        this.routes = routes; this.sessions = sessions; this.secureCookie = secureCookie;
        this.sessionLifetime = Duration.ofDays(sessionDays);
    }

    String newSecret() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    byte[] hash(String token) {
        try { return MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }

    @Transactional
    String establish(String publicId, String managementToken) {
        Route route = routes.findByPublicId(publicId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Route not found"));
        byte[] expected = route.getOwnerTokenHash();
        if (managementToken == null || expected == null || !MessageDigest.isEqual(expected, hash(managementToken)))
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid management token");
        String sessionToken = newSecret();
        Instant now = Instant.now();
        sessions.save(new RouteOwnerSession(route, hash(sessionToken), now.plus(sessionLifetime), now));
        return sessionToken;
    }

    void requireOwner(String publicId, HttpServletRequest request) {
        String token = cookieToken(request);
        if (token == null || sessions.findByRoute_PublicIdAndTokenHashAndExpiresAtAfter(publicId, hash(token), Instant.now()).isEmpty())
            throw new ApiException(HttpStatus.FORBIDDEN, "Route owner authorization required");
    }

    String cookieHeader(String publicId, String sessionToken) {
        return ResponseCookie.from(COOKIE_NAME, sessionToken).httpOnly(true).secure(secureCookie).sameSite("Lax")
                .path("/api/routes/" + publicId).maxAge(sessionLifetime).build().toString();
    }

    private String cookieToken(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies()).filter(cookie -> COOKIE_NAME.equals(cookie.getName()))
                .map(Cookie::getValue).findFirst().orElse(null);
    }
}
