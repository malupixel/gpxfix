package pl.routecommunity.api.route;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.*;
import pl.routecommunity.api.common.error.ApiException;

/** Resolves the HTTP branch selector; background jobs and legacy callers default to main. */
@Service
class RouteBranches {
    private final RouteBranchRepository branches;
    private final RouteVersionRepository versions;
    private final RouteRepository routes;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    RouteBranches(RouteBranchRepository branches,RouteVersionRepository versions,RouteRepository routes,org.springframework.jdbc.core.JdbcTemplate jdbc){this.jdbc=jdbc;this.branches=branches;this.versions=versions;this.routes=routes;}
    static String selectedKey() {
        var attributes=RequestContextHolder.getRequestAttributes();
        String key=attributes instanceof ServletRequestAttributes servlet?servlet.getRequest().getParameter("branch"):null;
        return key==null||key.isBlank()?"main":key;
    }
    RouteBranch selected(Route route){return branches.findByRoute_IdAndPublicId(route.getId(),selectedKey()).orElseThrow(()->missing());}
    RouteVersion current(Route route){return selected(route).getCurrentVersion();}
    RouteBranch initial(Route route){return branches.saveAndFlush(new RouteBranch(route,"main","Main",null,null));}
    void publish(Route route,RouteBranch branch,RouteVersion version){
        branch.publish(version);branches.saveAndFlush(branch);
        if(branch.getPublicId().equals("main"))route.publish(version);
    }
    int historyCount(Route route){return versions.ancestryCount(current(route).getId());}
    List<RouteVersionSummaryDto> history(Route route){
        long head=current(route).getId();
        return jdbc.query("""
            WITH RECURSIVE history AS (
              SELECT id,based_on_version_id FROM route_versions WHERE id=?
              UNION ALL SELECT p.id,p.based_on_version_id FROM route_versions p JOIN history c ON p.id=c.based_on_version_id
            )
            SELECT v.version_number,v.created_at,v.source,p.version_number AS parent_number,s.public_id AS suggestion_id,
                   v.id=? AS current,v.label,b.public_id AS branch_id
            FROM history h JOIN route_versions v ON v.id=h.id
            JOIN route_branches b ON b.id=v.branch_id LEFT JOIN route_versions p ON p.id=v.based_on_version_id
            LEFT JOIN route_suggestions s ON s.id=v.merged_suggestion_id ORDER BY v.version_number DESC
            """,(rs,n)->new RouteVersionSummaryDto(rs.getInt("version_number"),rs.getTimestamp("created_at").toInstant(),RouteVersionSource.valueOf(rs.getString("source")),rs.getObject("parent_number",Integer.class),rs.getString("suggestion_id"),rs.getBoolean("current"),rs.getString("label"),rs.getString("branch_id")),head,head);
    }
    void requireSuggestion(RouteSuggestion suggestion){
        if(!suggestion.getBranch().getPublicId().equals(selectedKey()))throw missing();
    }
    record Dto(String publicId,String name,String description,int currentVersion,Integer forkVersion,double distanceMeters) { }
    Dto dto(RouteBranch b){return new Dto(b.getPublicId(),b.getName(),b.getDescription(),b.getCurrentVersion().getVersionNumber(),b.getForkVersion()==null?null:b.getForkVersion().getVersionNumber(),b.getCurrentVersion().getDistanceMeters());}
    List<Dto> list(Route route){return jdbc.query("""
        SELECT b.public_id,b.name,b.description,v.version_number,p.version_number AS fork_number,v.distance_meters
        FROM route_branches b JOIN route_versions v ON v.id=b.current_version_id LEFT JOIN route_versions p ON p.id=b.fork_version_id
        WHERE b.route_id=? ORDER BY b.id
        """,(rs,n)->new Dto(rs.getString("public_id"),rs.getString("name"),rs.getString("description"),rs.getInt("version_number"),rs.getObject("fork_number",Integer.class),rs.getDouble("distance_meters")),route.getId());}
    @Transactional(readOnly=true) List<Dto> list(String publicId){return list(routes.findByPublicId(publicId).orElseThrow(RouteBranches::missing));}
    @Transactional Dto create(String publicId,int number,String name,String description){
        Route route=routes.findLockedByPublicId(publicId).orElseThrow(RouteBranches::missing);
        RouteVersion source=versions.findByRoute_PublicIdAndVersionNumber(publicId,number).orElseThrow(RouteBranches::missing);
        return dto(branches.saveAndFlush(new RouteBranch(route,UUID.randomUUID().toString(),name.trim(),description,source)));
    }
    @Transactional void label(String publicId,int number,String label){
        routes.findLockedByPublicId(publicId).orElseThrow(RouteBranches::missing);
        RouteVersion version=versions.findByRoute_PublicIdAndVersionNumber(publicId,number).orElseThrow(RouteBranches::missing);
        version.label(label==null||label.isBlank()?null:label.trim());versions.saveAndFlush(version);
    }
    private static ApiException missing(){return new ApiException(HttpStatus.NOT_FOUND,"Route branch or version not found");}
}
