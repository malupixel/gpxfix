package pl.routecommunity.api.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Stateless bearer authentication, scoped exclusively to the administrative API. */
@Component
@Order(1)
public class AdminAuthenticationFilter extends OncePerRequestFilter {
    private final byte[] expectedHash;
    private final ObjectMapper json;
    private long windowStarted = System.nanoTime();
    private int failures;
    // One admin, one API process: a global bound also prevents rotating-IP brute force.
    private static final int MAX_FAILURES = 20;
    private static final long WINDOW_NANOS = 60_000_000_000L;

    public AdminAuthenticationFilter(@Value("${app.admin.secret:}") String secret, ObjectMapper json) {
        if (!secret.isEmpty() && !secret.matches("[a-f0-9]{64}")) {
            throw new IllegalStateException("ADMIN_SECRET must contain 64 lowercase hex characters generated from 32 random bytes");
        }
        expectedHash = secret.isEmpty() ? null : hash(secret);
        this.json = json;
    }

    @Override protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = new org.springframework.web.util.UrlPathHelper().getPathWithinApplication(request);
        return !path.equals("/api/admin") && !path.startsWith("/api/admin/");
    }

    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws IOException, ServletException {
        response.setHeader("Cache-Control", "no-store");
        if (expectedHash == null) { reject(response, 503, "Administrative API is disabled"); return; }
        String header = request.getHeader("Authorization");
        String supplied = header != null && header.startsWith("Bearer ") ? header.substring(7) : "";
        int decision = authorize(supplied);
        if (decision != 0) {
            boolean limited = decision == 429;
            if (limited) response.setHeader("Retry-After", "60");
            else response.setHeader("WWW-Authenticate", "Bearer realm=\"TweakMyRoute Admin\"");
            reject(response, limited ? 429 : 401, limited ? "Too many authentication attempts" : "Administrator authorization required");
            return;
        }
        chain.doFilter(request, response);
    }

    private synchronized int authorize(String supplied) {
        long now = System.nanoTime();
        if (now - windowStarted >= WINDOW_NANOS) { failures = 0; windowStarted = now; }
        // Gate BEFORE verification: returning 429 only after comparing would still allow unlimited guessing.
        if (failures >= MAX_FAILURES) return 429;
        if (supplied.length() == 64 && MessageDigest.isEqual(expectedHash, hash(supplied))) return 0;
        failures++;
        return 401;
    }
    private static byte[] hash(String value) {
        try { return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    private void reject(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        json.writeValue(response.getOutputStream(), Map.of("timestamp", Instant.now().toString(), "status", status, "error", message));
    }
}
