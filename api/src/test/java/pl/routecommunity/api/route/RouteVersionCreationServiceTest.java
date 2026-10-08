package pl.routecommunity.api.route;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import pl.routecommunity.api.gpx.*;
import pl.routecommunity.api.storage.FileStorage;

class RouteVersionCreationServiceTest {
    @AfterEach void cleanup() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization();
    }

    @Test void storageIsRetainedOnCommitAndDeletedOnTransactionRollback() {
        for (int completion : List.of(TransactionSynchronization.STATUS_COMMITTED, TransactionSynchronization.STATUS_ROLLED_BACK)) {
            var versions = mock(RouteVersionRepository.class);
            var routes = mock(RouteRepository.class);
            var pipeline = mock(RouteVersionPipeline.class);
            var storage = mock(FileStorage.class);
            var source = GpxParser.calculateMetrics(List.of(List.of(new GpxPoint(52, 21, 100.0), new GpxPoint(52.01, 21.01, 110.0))));
            when(pipeline.prepare(anyString(), same(source), isNull())).thenReturn(new RouteVersionPipeline.Prepared(source, new byte[]{1, 2}));
            when(storage.store(any())).thenReturn("new-version.gpx");
            when(versions.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
            TransactionSynchronizationManager.initSynchronization();
            var route = new Route("route", new byte[32], Instant.now());
            var result = new RouteVersionCreationService(versions, routes, pipeline, storage,mock(RouteActivityService.class)).create(route, null, RouteVersionSource.INITIAL_DRAWN, null, "Route", null, "route.gpx", source, null, "DRAWN", null);
            assertThat(result.version().getDistanceMeters()).isEqualTo(source.distanceMeters());
            assertThat(result.version().getElevationGainMeters()).isEqualTo(10.0);
            assertThat(route.getCurrentVersion()).isSameAs(result.version());
            TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCompletion(completion));
            if (completion == TransactionSynchronization.STATUS_COMMITTED) verify(storage, never()).delete(any());
            else verify(storage).delete("new-version.gpx");
            TransactionSynchronizationManager.clearSynchronization();
        }
    }
}
