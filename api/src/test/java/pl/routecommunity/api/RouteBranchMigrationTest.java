package pl.routecommunity.api;
import static org.assertj.core.api.Assertions.*;
import java.sql.*;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker=true)
class RouteBranchMigrationTest {
    @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    @Test void populatedLinearHistoryAndDeletedRoutesSurviveMigrationWithoutGeometryCopies()throws Exception {
        Flyway.configure().dataSource(DB.getJdbcUrl(),DB.getUsername(),DB.getPassword()).target(MigrationVersion.fromVersion("11")).load().migrate();
        String before;
        try(var c=DriverManager.getConnection(DB.getJdbcUrl(),DB.getUsername(),DB.getPassword());var q=c.createStatement()) {
            c.setAutoCommit(false);
            q.execute("INSERT INTO routes(public_id,name,created_at,updated_at,owner_token_hash) VALUES ('legacy','Legacy',now(),now(),decode(repeat('ab',32),'hex'))");
            q.execute("INSERT INTO route_versions(route_id,version_number,created_at,source,name,original_filename,storage_key,distance_meters,track_geometry,source_type) SELECT id,1,now(),'INITIAL_UPLOAD','Legacy','x.gpx','v1',100,ST_GeomFromText('LINESTRING(21 52,22 53)',4326),'GPX' FROM routes");
            q.execute("INSERT INTO route_versions(route_id,version_number,created_at,source,based_on_version_id,name,original_filename,storage_key,distance_meters,track_geometry,source_type) SELECT route_id,2,now(),'OWNER_EDIT',id,'Legacy','x.gpx','v2',200,ST_GeomFromText('LINESTRING(21 52,23 53)',4326),'GPX' FROM route_versions");
            q.execute("UPDATE routes SET current_version_id=(SELECT id FROM route_versions WHERE version_number=2),deleted_at=now()");
            q.execute("INSERT INTO route_suggestions(public_id,route_id,base_version_id,type,moderation_status,integration_status,applicability,author_name,description,start_point,start_distance_meters,created_at,updated_at) SELECT 'note',route_id,id,'NOTE','PUBLISHED','NOT_APPLICABLE','NOT_APPLICABLE','Author','Note',ST_GeomFromText('POINT(21 52)',4326),0,now(),now() FROM route_versions WHERE version_number=1");
            q.execute("INSERT INTO suggestion_comments(public_id,suggestion_id,author_name,content,moderation_status,created_at,updated_at) SELECT 'comment',id,'Author','Text','PUBLISHED',now(),now() FROM route_suggestions");
            c.commit();before=snapshot(q);
        }
        var flyway=Flyway.configure().dataSource(DB.getJdbcUrl(),DB.getUsername(),DB.getPassword()).load();flyway.migrate();flyway.validate();assertThat(flyway.migrate().migrationsExecuted).isZero();
        try(var c=DriverManager.getConnection(DB.getJdbcUrl(),DB.getUsername(),DB.getPassword());var q=c.createStatement()) {
            assertThat(snapshot(q)).isEqualTo(before);
            try(var rows=q.executeQuery("SELECT b.public_id,b.current_version_id=r.current_version_id,(SELECT count(*) FROM route_versions WHERE branch_id=b.id),(SELECT count(*) FROM route_suggestions WHERE branch_id=b.id) FROM route_branches b JOIN routes r ON r.id=b.route_id")) {
                assertThat(rows.next()).isTrue();assertThat(rows.getString(1)).isEqualTo("main");assertThat(rows.getBoolean(2)).isTrue();assertThat(rows.getInt(3)).isEqualTo(2);assertThat(rows.getInt(4)).isEqualTo(1);assertThat(rows.next()).isFalse();
            }
        }
    }
    String snapshot(Statement q)throws Exception {
        try(var rows=q.executeQuery("SELECT jsonb_build_object('routes',(SELECT jsonb_agg(to_jsonb(r)-'source_route_public_id'-'source_version_number'-'source_version_id'-'source_route_name') FROM routes r),'versions',(SELECT jsonb_agg(to_jsonb(v)-'branch_id'-'label' ORDER BY id) FROM route_versions v),'suggestions',(SELECT jsonb_agg(to_jsonb(s)-'branch_id') FROM route_suggestions s),'comments',(SELECT jsonb_agg(to_jsonb(c)) FROM suggestion_comments c),'activity',(SELECT jsonb_agg(to_jsonb(a)) FROM route_activity a))::text")){rows.next();return rows.getString(1);}
    }
}
