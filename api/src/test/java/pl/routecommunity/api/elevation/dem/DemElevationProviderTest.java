package pl.routecommunity.api.elevation.dem;

import static org.assertj.core.api.Assertions.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import pl.routecommunity.api.common.error.ApiException;
import pl.routecommunity.api.elevation.ElevationProvider.Coordinate;

class DemElevationProviderTest {
    @TempDir Path directory;

    private void tile(String name, int value) throws IOException {
        try(var output=new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(directory.resolve(name))))){
            for(int i=0;i<1201*1201;i++)output.writeShort(value);
        }
    }

    @Test void readsSignedBigEndianHeightsAndPreservesBatchOrder() throws IOException {
        tile("N52E021.hgt",123);tile("N52E022.hgt",-12);
        var provider=new DemElevationProvider(directory.toString(),26);
        assertThat(provider.elevations(List.of(new Coordinate(52.5,22.5),new Coordinate(52.5,21.5),new Coordinate(52.6,22.6))))
                .containsExactly(-12.0,123.0,-12.0);
    }

    @Test void fullResolutionTileSupportsThousandsOfSamples() throws IOException {
        try(var file=new RandomAccessFile(directory.resolve("N52E021.hgt").toFile(),"rw")){
            file.setLength(3601L*3601*2);file.seek((1800L*3601+1800)*2);file.writeShort(321);
        }
        List<Coordinate> coordinates=new ArrayList<>();
        for(int i=0;i<=3000;i++)coordinates.add(new Coordinate(52.4+i*0.2/3000,21.5));
        var heights=new DemElevationProvider(directory.toString(),26).elevations(coordinates);
        assertThat(heights).hasSize(3001);assertThat(heights.get(1500)).isEqualTo(321);
        assertThat(heights.getFirst()).isZero();assertThat(heights.getLast()).isZero();
    }

    @Test void interpolatesFourRasterNodes() throws IOException {
        tile("N52E021.hgt",0);
        try(var file=new RandomAccessFile(directory.resolve("N52E021.hgt").toFile(),"rw")){
            file.writeShort(0);file.writeShort(100);file.seek(1201*2);file.writeShort(200);file.writeShort(300);
        }
        var data=new DemTileReader().read(directory.resolve("N52E021.hgt"));
        assertThat(data.elevation(new DemDataset.Tile(52,21),53-0.5/1200,21+0.5/1200)).isCloseTo(150,within(0.000001));
    }

    @Test void boundaryUsesSharedNodesIncludingMissingPrimaryNeighbour() throws IOException {
        tile("N52E021.hgt",234);var provider=new DemElevationProvider(directory.toString(),26);
        assertThat(provider.elevations(List.of(new Coordinate(53,22),new Coordinate(52.5,22),new Coordinate(53,21.5))))
                .containsExactly(234.0,234.0,234.0);
        tile("N52E022.hgt",234);
        assertThat(provider.elevations(List.of(new Coordinate(52.5,22-1e-8),new Coordinate(52.5,22),new Coordinate(52.5,22+1e-8))))
                .containsExactly(234.0,234.0,234.0);
    }

    @Test void missingCoverageAndNoDataAreVisibleErrorsNotZeroOrRemoteFallback() throws IOException {
        var provider=new DemElevationProvider(directory.toString(),26);
        assertThatThrownBy(()->provider.elevations(List.of(new Coordinate(52.5,21.5)))).isInstanceOf(ApiException.class).hasMessageContaining("unavailable");
        tile("N52E021.hgt",Short.MIN_VALUE);
        assertThatThrownBy(()->provider.elevations(List.of(new Coordinate(52.5,21.5)))).isInstanceOf(ApiException.class);
    }

    @Test void corruptTileIsRejectedAndInvalidConfigurationFailsEarly() throws IOException {
        Files.write(directory.resolve("N52E021.hgt"),new byte[10]);
        assertThatThrownBy(()->new DemTileReader().read(directory.resolve("N52E021.hgt"))).isInstanceOf(IOException.class);
        assertThatThrownBy(()->new DemElevationProvider(directory.resolve("missing").toString(),128)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->new DemElevationProvider(directory.toString(),1)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test void cacheLoadsOnceAndEvictsByMemoryBudget() throws IOException {
        tile("N52E021.hgt",1);tile("N52E022.hgt",2);
        int[] reads={0};var reader=new DemTileReader(){@Override public TileData read(Path path)throws IOException{reads[0]++;return super.read(path);}};
        var dataset=new DemDataset(directory);var cache=new DemTileCache(dataset,reader,3601L*3601*2);
        var first=new DemDataset.Tile(52,21);cache.withTile(first,data->{});cache.withTile(first,data->{});
        assertThat(reads[0]).isEqualTo(1);
        // Cache several synthetic tiles to exceed a single full-resolution tile's budget.
        for(int west=22;west<32;west++){tile("N52E0"+west+".hgt",2);cache.withTile(new DemDataset.Tile(52,west),data->{});}
        assertThat(cache.cachedBytes()).isLessThanOrEqualTo(3601L*3601*2);
        cache.withTile(first,data->{});assertThat(reads[0]).isEqualTo(12);
    }
}
