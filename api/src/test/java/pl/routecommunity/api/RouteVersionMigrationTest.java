package pl.routecommunity.api;

import static org.assertj.core.api.Assertions.assertThat;
import java.sql.*;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker=true)
class RouteVersionMigrationTest {
    @Container static final PostgreSQLContainer<?> POSTGRES=new PostgreSQLContainer<>(DockerImageName.parse("postgis/postgis:17-3.5").asCompatibleSubstituteFor("postgres"));
    @Test void existingV6RouteAndSuggestionAreBackfilledToVersionOne()throws Exception{
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword()).target(MigrationVersion.fromVersion("6")).load().migrate();
        try(Connection connection=DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword());Statement sql=connection.createStatement()){
            sql.executeUpdate("insert into routes(public_id,name,description,original_filename,storage_key,distance_meters,elevation_gain_meters,track_geometry,created_at,updated_at,source_type) values ('legacy','Legacy','old','legacy.gpx','legacy-key',1000,20,ST_GeomFromText('LINESTRING(21 52,21.01 52.01)',4326),now(),now(),'GPX')");
            sql.executeUpdate("insert into route_suggestions(public_id,route_id,type,moderation_status,integration_status,applicability,author_name,description,start_point,start_distance_meters,base_route_updated_at,created_at,updated_at) select 'legacy-s',id,'NOTE','PUBLISHED','NOT_APPLICABLE','NOT_APPLICABLE','A','note',ST_GeomFromText('POINT(21 52)',4326),0,updated_at,now(),now() from routes where public_id='legacy'");
        }
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword()).load().migrate();
        try(Connection connection=DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword());Statement sql=connection.createStatement()){
            try(ResultSet result=sql.executeQuery("select v.version_number,v.name,v.storage_key,r.current_version_id=v.id from routes r join route_versions v on v.route_id=r.id where r.public_id='legacy'")){assertThat(result.next()).isTrue();assertThat(result.getInt(1)).isEqualTo(1);assertThat(result.getString(2)).isEqualTo("Legacy");assertThat(result.getString(3)).isEqualTo("legacy-key");assertThat(result.getBoolean(4)).isTrue();}
            try(ResultSet result=sql.executeQuery("select s.base_version_id=r.current_version_id from route_suggestions s join routes r on r.id=s.route_id where s.public_id='legacy-s'")){assertThat(result.next()).isTrue();assertThat(result.getBoolean(1)).isTrue();}
            try(ResultSet result=sql.executeQuery("select count(*) from information_schema.columns where table_name='routes' and column_name='track_geometry'")){result.next();assertThat(result.getInt(1)).isZero();}
        }
    }
}
