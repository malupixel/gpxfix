package pl.routecommunity.api.route;

import java.time.Instant;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import pl.routecommunity.api.common.error.ApiException;

/** Narrow bridge to package-private domain entities. Public/owner authorization stays unchanged. */
@Service
public class AdminRouteMutationService {
    private final RouteRepository routes;
    private final RouteManagementService management;
    private final JdbcTemplate jdbc;
    public AdminRouteMutationService(RouteRepository routes,RouteManagementService management,JdbcTemplate jdbc) {
        this.routes=routes;this.management=management;this.jdbc=jdbc;
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void change(long id,boolean deleted,boolean expectedDeleted,String confirmationName) {
        Route route=locked(id);
        if(!route.getName().equals(confirmationName)) throw new ApiException(HttpStatus.BAD_REQUEST,"Route name confirmation does not match");
        verify(route,expectedDeleted);
        if(deleted==expectedDeleted) throw new ApiException(HttpStatus.BAD_REQUEST,"Status transition required");
        transition(route,deleted);
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void bulkDelete(List<Long> ids) {
        // Consistent lock order avoids deadlocks. Validate every route before changing any.
        List<Route> locked=ids.stream().sorted().map(this::locked).toList();
        locked.forEach(route->verify(route,false));
        locked.forEach(route->transition(route,true));
    }
    private Route locked(long id) {
        return routes.findAdminLockedById(id).orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"Route not found"));
    }
    private void verify(Route route,boolean expectedDeleted) {
        if((route.getDeletedAt()!=null)!=expectedDeleted) throw new ApiException(HttpStatus.CONFLICT,"Route status changed; reload before continuing");
    }
    private void transition(Route route,boolean deleted) {
        Instant now=Instant.now();
        if(deleted) management.softDelete(route,now); else route.restore(now);
        jdbc.update("""
            INSERT INTO route_activity(route_id,event_type,occurred_at,actor_kind,owner_only,event_key)
            VALUES (?,?,?,'ADMIN',true,?)
            """,route.getId(),deleted?"ROUTE_DELETED":"ROUTE_RESTORED",Timestamp.from(now),"admin:"+UUID.randomUUID());
    }
}
