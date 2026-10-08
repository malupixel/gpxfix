package pl.routecommunity.api.route;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import pl.routecommunity.api.common.error.ApiException;

@Service
class RouteActivityService {
    private final JdbcTemplate jdbc;
    private final RouteRepository routes;
    private final ObjectMapper json;
    RouteActivityService(JdbcTemplate jdbc, RouteRepository routes, ObjectMapper json) {
        this.jdbc=jdbc; this.routes=routes; this.json=json;
    }
    // JDBC participates in the same transaction as the business entities.
    @Transactional(propagation=Propagation.MANDATORY)
    void record(Route route, RouteActivityType type, Instant at, RouteVersion version, RouteSuggestion suggestion,
            SuggestionComment comment, String actorName, boolean ownerOnly, String eventKey) {
        record(route,type,at,version,suggestion,comment,actorName,ownerOnly,eventKey,null);
    }
    @Transactional(propagation=Propagation.MANDATORY)
    void record(Route route, RouteActivityType type, Instant at, RouteVersion version, RouteSuggestion suggestion,
            SuggestionComment comment, String actorName, boolean ownerOnly, String eventKey, Command command) {
        jdbc.update("""
            INSERT INTO route_activity(route_id,event_type,occurred_at,version_id,suggestion_id,comment_id,
                actor_kind,actor_name,owner_only,event_key,request_key,request_hash)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(route_id,event_key) DO NOTHING
            """, route.getId(),type.name(),Timestamp.from(at),version==null?null:version.getId(),
            suggestion==null?null:suggestion.getId(),comment==null?null:comment.getId(),
            actorName==null?"OWNER":"CONTRIBUTOR",actorName,ownerOnly,eventKey,
            command==null?null:command.key(),command==null?null:command.hash());
    }
    record Command(String key, String hash, String replayPublicId) { }
    // Callers hold the route lock, so simultaneous retries cannot create duplicate subjects/events.
    Command command(Route route, RouteActivityType type, String key, Object body) {
        if(key==null) return null;
        if(!key.matches("[A-Za-z0-9_-]{1,120}")) throw new ApiException(HttpStatus.BAD_REQUEST,"Invalid idempotency key");
        String scoped=type.name()+":"+key;
        String hash;
        try { hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(body))); }
        catch(Exception e) { throw new IllegalStateException("Cannot fingerprint command",e); }
        var rows=jdbc.query("""
            SELECT a.request_hash,coalesce(c.public_id,s.public_id) AS subject
            FROM route_activity a LEFT JOIN route_suggestions s ON s.id=a.suggestion_id
            LEFT JOIN suggestion_comments c ON c.id=a.comment_id WHERE a.route_id=? AND a.request_key=?
            """,(rs,n)->Map.entry(rs.getString("request_hash"),rs.getString("subject")),route.getId(),scoped);
        if(rows.isEmpty()) return new Command(scoped,hash,null);
        if(!hash.equals(rows.getFirst().getKey())) throw new ApiException(HttpStatus.CONFLICT,"Idempotency key was reused with different data");
        return new Command(scoped,hash,rows.getFirst().getValue());
    }
    @Transactional(readOnly=true)
    RouteActivityDto.Page list(String publicId, boolean owner, int limit, String cursor) {
        Route route=routes.findByPublicId(publicId).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Route not found"));
        if(limit<1||limit>100) throw new ApiException(HttpStatus.BAD_REQUEST,"Activity limit must be between 1 and 100");
        List<Object> params=new ArrayList<>(List.of(route.getId()));
        String before="";
        if(cursor!=null) {
            try {
                String[] values=new String(Base64.getUrlDecoder().decode(cursor),StandardCharsets.UTF_8).split("_",2);
                params.add(Timestamp.from(Instant.parse(values[0]))); params.add(UUID.fromString(values[1]));
                before=" AND (a.occurred_at,a.id)<(?,?)";
            } catch(Exception e) { throw new ApiException(HttpStatus.BAD_REQUEST,"Invalid activity cursor"); }
        }
        String visibility=owner?"":"""
             AND NOT a.owner_only AND (a.suggestion_id IS NULL OR s.moderation_status='PUBLISHED')
             AND (a.comment_id IS NULL OR c.moderation_status='PUBLISHED')
            """;
        params.add(limit+1);
        var items=jdbc.query("""
            SELECT a.id,a.event_type,a.occurred_at,v.version_number,s.public_id AS suggestion_public_id,
                c.public_id AS comment_public_id,a.actor_kind,a.actor_name
            FROM route_activity a LEFT JOIN route_versions v ON v.id=a.version_id
            LEFT JOIN route_suggestions s ON s.id=a.suggestion_id LEFT JOIN suggestion_comments c ON c.id=a.comment_id
            WHERE a.route_id=?
            """+before+visibility+" ORDER BY a.occurred_at DESC,a.id DESC LIMIT ?",(rs,n)->new RouteActivityDto(
                rs.getObject("id",UUID.class),rs.getString("event_type"),rs.getTimestamp("occurred_at").toInstant(),
                rs.getObject("version_number",Integer.class),rs.getString("suggestion_public_id"),rs.getString("comment_public_id"),
                rs.getString("actor_kind"),rs.getString("actor_name"),Map.of()),params.toArray());
        boolean more=items.size()>limit;
        var page=List.copyOf(items.subList(0,Math.min(limit,items.size())));
        var last=page.isEmpty()?null:page.getLast();
        String next=more?Base64.getUrlEncoder().withoutPadding().encodeToString((last.occurredAt()+"_"+last.id()).getBytes(StandardCharsets.UTF_8)):null;
        return new RouteActivityDto.Page(page,next);
    }
}
