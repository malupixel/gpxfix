package pl.routecommunity.api.route;

import static org.assertj.core.api.Assertions.*;
import java.sql.*;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker=true)
class RoutePreviewMigrationTest {
    @Container static final PostgreSQLContainer<?> POSTGRES=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    @Test void v10InvalidatesReadyAndFailedJobsWithoutTouchingRoutesVersionsOrActivity() throws Exception {
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword()).target(MigrationVersion.fromVersion("9")).load().migrate();
        String before;
        try(var c=DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword());var sql=c.createStatement()) {
            c.setAutoCommit(false);
            sql.executeUpdate("INSERT INTO routes(public_id,name,created_at,updated_at) VALUES ('legacy-og','Łódź',now(),now())");
            sql.executeUpdate("INSERT INTO route_versions(route_id,version_number,created_at,source,name,original_filename,storage_key,distance_meters,track_geometry,source_type) SELECT id,1,now(),'INITIAL_UPLOAD','Łódź','route.gpx','legacy.gpx',1234,ST_GeomFromText('LINESTRING(21 52,21.01 52.01)',4326),'GPX' FROM routes WHERE public_id='legacy-og'");
            sql.executeUpdate("UPDATE routes SET current_version_id=(SELECT id FROM route_versions WHERE version_number=1) WHERE public_id='legacy-og'");
            sql.executeUpdate("INSERT INTO route_share_previews(version_id,name,revision,ready,attempts) SELECT id,'Łódź',repeat('a',64),true,1 FROM route_versions");
            sql.executeUpdate("INSERT INTO route_share_previews(version_id,name,revision,ready,attempts) SELECT id,'Previous name',repeat('b',64),false,4 FROM route_versions");
            c.commit();before=snapshot(sql);
        }
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword()).load().migrate();
        try(var c=DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword());var sql=c.createStatement()) {
            assertThat(snapshot(sql)).isEqualTo(before);
            try(var rows=sql.executeQuery("SELECT count(*) FROM route_share_previews")){rows.next();assertThat(rows.getInt(1)).isZero();}
            try(var rows=sql.executeQuery("SELECT count(*) FROM route_versions v JOIN routes r ON v.route_id=r.id LEFT JOIN route_share_previews p ON p.version_id=v.id AND p.name=r.name WHERE r.deleted_at IS NULL AND p.version_id IS NULL")){rows.next();assertThat(rows.getInt(1)).isEqualTo(1);}
        }
    }
    private String snapshot(Statement sql) throws Exception {
        try(var rows=sql.executeQuery("SELECT jsonb_build_object('routes',(SELECT jsonb_agg(to_jsonb(r)) FROM routes r),'versions',(SELECT jsonb_agg(to_jsonb(v)) FROM route_versions v),'activity',(SELECT jsonb_agg(to_jsonb(a)) FROM route_activity a))::text")) {rows.next();return rows.getString(1);}
    }
}
