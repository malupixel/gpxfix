package pl.routecommunity.api.admin;

import static pl.routecommunity.api.admin.AdminDtos.*;

import java.nio.file.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import pl.routecommunity.api.common.error.ApiException;

@Service
@Transactional(readOnly=true)
public class AdminQueryService {
    private final NamedParameterJdbcTemplate jdbc;
    private final Path gpxRoot;
    private final Path previewRoot;
    private final String backendVersion;
    private static final String ROUTE_FROM = " FROM routes r LEFT JOIN route_versions v ON v.id=r.current_version_id ";
    private static final String ROUTE_SELECT = """
        SELECT r.id,r.public_id,r.name,r.created_at,r.updated_at,r.deleted_at,
          coalesce(v.distance_meters,0)/1000 AS distance_km,
          (SELECT count(*) FROM route_versions x WHERE x.route_id=r.id) AS version_count,
          (SELECT count(*) FROM route_suggestions x WHERE x.route_id=r.id) AS suggestion_count
        """;
    private static final RowMapper<RouteRow> ROUTE_MAPPER = (rs,n) -> new RouteRow(rs.getLong("id"),
        rs.getString("public_id"),rs.getString("name"),instant(rs,"created_at"),instant(rs,"updated_at"),
        rs.getDouble("distance_km"),rs.getLong("version_count"),rs.getLong("suggestion_count"),instant(rs,"deleted_at"));
    private static final String SUGGESTION_FROM = " FROM route_suggestions s JOIN routes r ON r.id=s.route_id ";
    private static final String SUGGESTION_SELECT = """
        SELECT s.id,s.public_id,s.route_id,r.public_id AS route_public_id,r.name AS route_name,s.type,
            s.moderation_status,s.integration_status,s.applicability,s.description,s.created_at
        """;
    private static final RowMapper<SuggestionRow> SUGGESTION_MAPPER = (rs,n) -> new SuggestionRow(rs.getLong("id"),
        rs.getString("public_id"),rs.getLong("route_id"),rs.getString("route_public_id"),rs.getString("route_name"),
        rs.getString("type"),rs.getString("moderation_status"),rs.getString("integration_status"),
        rs.getString("applicability"),rs.getString("description"),instant(rs,"created_at"));

    public AdminQueryService(NamedParameterJdbcTemplate jdbc,
            @Value("${app.storage.gpx-path}") Path gpxRoot,
            @Value("${app.preview.storage-path:${app.storage.gpx-path}/previews}") Path previewRoot,
            ObjectProvider<BuildProperties> build) {
        this.jdbc=jdbc; this.gpxRoot=gpxRoot.toAbsolutePath().normalize();
        this.previewRoot=previewRoot.toAbsolutePath().normalize();
        this.backendVersion=build.getIfAvailable()==null?"unknown":build.getObject().getVersion();
    }

    public Page<RouteRow> routes(int page,int size,String search,String status,LocalDate from,LocalDate to,
            String candidate,String sort,String direction) {
        bounds(page,size);
        Map<String,Object> args=new HashMap<>();
        StringBuilder where=new StringBuilder(" WHERE true ");
        if (!Set.of("ALL","ACTIVE","DELETED").contains(status)) bad("Invalid route status");
        if(status.equals("ACTIVE")) where.append(" AND r.deleted_at IS NULL");
        if(status.equals("DELETED")) where.append(" AND r.deleted_at IS NOT NULL");
        search(where,args,search,"r.name","r.id","r.public_id");
        if(from!=null && to!=null && from.isAfter(to)) bad("Invalid date range");
        if(from!=null) { where.append(" AND r.created_at>=:from"); args.put("from",Timestamp.from(from.atStartOfDay(ZoneOffset.UTC).toInstant())); }
        if(to!=null) { where.append(" AND r.created_at<:to"); args.put("to",Timestamp.from(to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant())); }
        String condition=switch(candidate) {
            case "ALL" -> "";
            case "SHORT" -> " AND v.distance_meters<1000";
            case "UNNAMED" -> " AND trim(r.name)=''";
            case "TEST_NAME" -> " AND lower(r.name) ~ '(test|debug|tmp)'";
            case "OLD_WITHOUT_SUGGESTIONS" -> " AND r.created_at<now()-interval '180 days' AND NOT EXISTS(SELECT 1 FROM route_suggestions s WHERE s.route_id=r.id)";
            case "INCOMPLETE" -> " AND (v.id IS NULL OR ST_NPoints(v.track_geometry)<2 OR NOT ST_IsValid(v.track_geometry) OR v.distance_meters=0)";
            default -> throw new ApiException(HttpStatus.BAD_REQUEST,"Invalid candidate filter");
        };
        where.append(condition);
        String column=switch(sort) {
            case "id" -> "r.id"; case "name" -> "lower(r.name)"; case "publicId" -> "r.public_id";
            case "createdAt" -> "r.created_at"; case "updatedAt" -> "r.updated_at";
            case "distanceKm" -> "coalesce(v.distance_meters,0)";
            default -> throw new ApiException(HttpStatus.BAD_REQUEST,"Invalid sort column");
        };
        if(!Set.of("ASC","DESC").contains(direction)) bad("Invalid sort direction");
        long total=count("SELECT count(*)"+ROUTE_FROM+where,args);
        paging(args,page,size);
        return new Page<>(jdbc.query(ROUTE_SELECT+ROUTE_FROM+where+" ORDER BY "+column+" "+direction+",r.id "+direction+" LIMIT :size OFFSET :offset",args,ROUTE_MAPPER),total,page,size);
    }

    public RouteRow route(long id) {
        var rows=jdbc.query(ROUTE_SELECT+ROUTE_FROM+" WHERE r.id=:id",Map.of("id",id),ROUTE_MAPPER);
        if(rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,"Route not found");
        return rows.getFirst();
    }

    public RouteDetails details(long id) {
        RouteRow route=route(id);
        return jdbc.query("""
            SELECT r.description,r.original_upload_filename,r.original_upload_storage_key,r.suggestions_enabled,v.source_type,ST_NPoints(v.track_geometry) AS points,
              ST_SRID(v.track_geometry) AS srid,ST_IsValid(v.track_geometry) AS valid,
              (ST_Extent(v.track_geometry) OVER ())::text AS bounding_box,
              (SELECT count(*) FROM suggestion_comments c JOIN route_suggestions s ON s.id=c.suggestion_id WHERE s.route_id=r.id) AS comments,
              (SELECT count(*) FROM route_activity a WHERE a.route_id=r.id) AS activity
            """+ROUTE_FROM+" WHERE r.id=:id",Map.of("id",id),(rs,n)->new RouteDetails(route,
                rs.getString("description"),rs.getString("original_upload_filename"),rs.getString("original_upload_storage_key"),rs.getBoolean("suggestions_enabled"),rs.getString("source_type"),
                rs.getInt("points"),rs.getInt("srid"),rs.getBoolean("valid"),rs.getString("bounding_box"),
                rs.getLong("comments"),rs.getLong("activity"),files(id,0,20).items())).getFirst();
    }

    public Page<VersionRow> versions(long id,int page,int size) {
        bounds(page,size); route(id);
        Map<String,Object> args=new HashMap<>(Map.of("id",id));
        long total=count("SELECT count(*) FROM route_versions WHERE route_id=:id",args); paging(args,page,size);
        var items=jdbc.query("""
            SELECT id,version_number,source,created_at,distance_meters/1000 AS distance_km,original_filename,storage_key
            FROM route_versions WHERE route_id=:id ORDER BY version_number DESC LIMIT :size OFFSET :offset
            """,args,(rs,n)->new VersionRow(rs.getLong("id"),rs.getInt("version_number"),rs.getString("source"),
                instant(rs,"created_at"),rs.getDouble("distance_km"),rs.getString("original_filename"),rs.getString("storage_key")));
        return new Page<>(items,total,page,size);
    }

    public Page<SuggestionRow> suggestions(int page,int size,String status,String search,Long routeId) {
        bounds(page,size);
        Map<String,Object> args=new HashMap<>(); StringBuilder where=new StringBuilder(" WHERE true");
        if(!Set.of("ALL","PENDING","PUBLISHED","REJECTED").contains(status)) bad("Invalid moderation status");
        if(!status.equals("ALL")) { where.append(" AND s.moderation_status=:status"); args.put("status",status); }
        if(routeId!=null) { where.append(" AND s.route_id=:routeId"); args.put("routeId",routeId); }
        search(where,args,search,"r.name","r.id","r.public_id");
        long total=count("SELECT count(*)"+SUGGESTION_FROM+where,args); paging(args,page,size);
        return new Page<>(jdbc.query(SUGGESTION_SELECT+SUGGESTION_FROM+where+" ORDER BY s.created_at DESC,s.id DESC LIMIT :size OFFSET :offset",args,SUGGESTION_MAPPER),total,page,size);
    }

    public Page<ActivityRow> activity(Long id,int page,int size) {
        bounds(page,size);
        if(id!=null) route(id);
        Map<String,Object> args=new HashMap<>(); String where=id==null?"":" WHERE a.route_id=:id";
        if(id!=null) args.put("id",id);
        long total=count("SELECT count(*) FROM route_activity a"+where,args); paging(args,page,size);
        return new Page<>(jdbc.query("""
            SELECT a.id,a.route_id,r.public_id,a.event_type,a.occurred_at,a.actor_kind
            FROM route_activity a JOIN routes r ON r.id=a.route_id
            """+where+" ORDER BY a.occurred_at DESC,a.id DESC LIMIT :size OFFSET :offset",args,(rs,n)->new ActivityRow(
                rs.getString("id"),rs.getLong("route_id"),rs.getString("public_id"),rs.getString("event_type"),instant(rs,"occurred_at"),rs.getString("actor_kind"))),total,page,size);
    }

    // UNION de-duplicates GPX keys shared by the original upload and a version.
    private static final String FILES = """
        SELECT 'GPX' AS kind,original_upload_storage_key AS key FROM routes WHERE id=:id AND original_upload_storage_key IS NOT NULL
        UNION SELECT 'GPX',storage_key FROM route_versions WHERE route_id=:id
        UNION SELECT 'PREVIEW',p.revision||'.png' FROM route_share_previews p JOIN route_versions v ON v.id=p.version_id WHERE v.route_id=:id
        """;
    public Page<FileRow> files(long id,int page,int size) {
        bounds(page,size);
        Map<String,Object> args=new HashMap<>(Map.of("id",id));
        long total=count("SELECT count(*) FROM ("+FILES+") f",args); paging(args,page,size);
        return new Page<>(jdbc.query("SELECT * FROM ("+FILES+") f ORDER BY kind,key LIMIT :size OFFSET :offset",args,
            (rs,n)->file(rs.getString("kind"),rs.getString("key"))),total,page,size);
    }
    private FileRow file(String kind,String key) {
        Path root=kind.equals("GPX")?gpxRoot:previewRoot;
        // Never disclose absolute infrastructure paths or follow symlinks outside storage.
        if(!key.matches("[A-Za-z0-9_-]+\\.(gpx|png)")) return new FileRow(kind,key,false,null);
        Path path=root.resolve(key);
        try {
            boolean exists=Files.isRegularFile(path,LinkOption.NOFOLLOW_LINKS);
            return new FileRow(kind,key,exists,exists?Files.size(path):null);
        } catch(java.io.IOException e) { return new FileRow(kind,key,false,null); }
    }

    public Dashboard dashboard() {
        var stats=jdbc.queryForMap("""
            SELECT count(*) AS total,count(*) FILTER(WHERE deleted_at IS NULL) AS active,
              count(*) FILTER(WHERE deleted_at IS NOT NULL) AS deleted,
              count(*) FILTER(WHERE created_at>=now()-interval '7 days') AS week,
              count(*) FILTER(WHERE created_at>=now()-interval '30 days') AS month FROM routes
            """,Map.of());
        Map<String,Long> statuses=new LinkedHashMap<>(Map.of("PENDING",0L,"PUBLISHED",0L,"REJECTED",0L));
        jdbc.query("SELECT moderation_status,count(*) AS total FROM route_suggestions GROUP BY moderation_status",Map.of(),
            (org.springframework.jdbc.core.RowCallbackHandler) rs->statuses.put(rs.getString(1),rs.getLong(2)));
        return new Dashboard(number(stats,"total"),number(stats,"active"),number(stats,"deleted"),number(stats,"week"),number(stats,"month"),
            statuses.values().stream().mapToLong(Long::longValue).sum(),statuses,count("SELECT count(*) FROM route_versions",Map.of()),
            routes(0,8,"","ALL",null,null,"ALL","createdAt","DESC").items(),activity(null,0,12).items());
    }
    public SystemStatus system() {
        boolean connected=Boolean.TRUE.equals(jdbc.queryForObject("SELECT true",Map.of(),Boolean.class));
        long bytes=count("SELECT pg_database_size(current_database())",Map.of());
        long gpx=count("SELECT count(*) FROM (SELECT storage_key FROM route_versions UNION SELECT original_upload_storage_key FROM routes WHERE original_upload_storage_key IS NOT NULL) f",Map.of());
        return new SystemStatus("UP",backendVersion,connected,bytes,gpx,count("SELECT count(*) FROM route_share_previews",Map.of()),false);
    }
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public DeletePlan deletePlan(long id) {
        RouteDetails details=details(id);
        Map<String,Object> args=Map.of("id",id);
        Page<FileRow> files=files(id,0,100);
        List<String> warnings=new ArrayList<>(List.of("Trwałe usuwanie jest wyłączone. Ten odczyt nie blokuje trasy i pokazuje stan z chwili zapytania.",
            "Cykliczne referencje wersji i sugestii oraz klucze obce aktywności wymagają osobnego przeglądu kolejności usuwania.",
            "Należy skoordynować worker podglądów. Usuwania plików nie można cofnąć razem z transakcją PostgreSQL.",
            "Nie można wiarygodnie odtworzyć referencji do starszych oryginałów ani osieroconych plików wyłącznie z bazy."));
        if(files.total()>100) warnings.add("Pokazano pierwsze 100 z "+files.total()+" plików. Pełną listę udostępnia stronicowana zakładka Pliki.");
        return new DeletePlan(id,details.route().versionCount(),details.route().suggestionCount(),details.commentCount(),details.activityCount(),
            count("SELECT count(*) FROM route_owner_sessions WHERE route_id=:id",args),
            count("SELECT count(*) FROM route_share_previews p JOIN route_versions v ON v.id=p.version_id WHERE v.route_id=:id",args),files.items(),false,warnings);
    }
    private long count(String sql,Map<String,?> args) { return Objects.requireNonNull(jdbc.queryForObject(sql,args,Long.class)); }
    private static long number(Map<String,Object> map,String key) { return ((Number)map.get(key)).longValue(); }
    private static Instant instant(ResultSet rs,String column) throws SQLException { Timestamp at=rs.getTimestamp(column); return at==null?null:at.toInstant(); }
    private static void bounds(int page,int size) { if(page<0||page>100000||size<1||size>100) bad("Page must be 0..100000 and size 1..100"); }
    private static void paging(Map<String,Object> args,int page,int size) { args.put("size",size);args.put("offset",(long)page*size); }
    private static void search(StringBuilder where,Map<String,Object> args,String search,String name,String id,String publicId) {
        if(search==null||search.isBlank()) return;
        if(search.length()>200) bad("Search is too long");
        args.put("search","%"+search.trim().toLowerCase(Locale.ROOT).replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%");
        where.append(" AND (lower(").append(name).append(") LIKE :search OR ").append(id).append("::text LIKE :search OR lower(").append(publicId).append(") LIKE :search)");
    }
    private static void bad(String message) { throw new ApiException(HttpStatus.BAD_REQUEST,message); }
}
