package pl.routecommunity.api.elevation.dem;

import java.io.IOException;
import java.util.LinkedHashMap;

/** Bounded LRU of decoded rasters. Loading is serialized, so a tile is loaded once. No open file handles. */
public class DemTileCache {
    private final DemDataset dataset;
    private final DemTileReader reader;
    private final long maximumBytes;
    private final LinkedHashMap<DemDataset.Tile, DemTileReader.TileData> tiles = new LinkedHashMap<>(16, .75f, true);
    private long bytes;

    public DemTileCache(DemDataset dataset, DemTileReader reader, long maximumBytes) {
        if (maximumBytes < 3601L * 3601 * 2) throw new IllegalArgumentException("DEM cache must fit at least one 3601x3601 tile (26 MB)");
        this.dataset = dataset;this.reader = reader;this.maximumBytes = maximumBytes;
    }

    // Callback keeps rasters inside the cache lock: concurrent requests cannot pin evicted tiles in RAM.
    public synchronized void withTile(DemDataset.Tile key, TileConsumer consumer) throws IOException {
        var tile = tiles.get(key);
        if (tile == null) {
            long required = java.nio.file.Files.size(dataset.path(key));
            if (required > maximumBytes) throw new IOException("DEM tile exceeds cache capacity: " + key.filename());
            while (bytes + required > maximumBytes && !tiles.isEmpty()) {
                var iterator = tiles.entrySet().iterator();bytes -= iterator.next().getValue().bytes();iterator.remove();
            }
            tile = reader.read(dataset.path(key));tiles.put(key, tile);bytes += tile.bytes();
        }
        consumer.accept(tile);
    }

    @FunctionalInterface public interface TileConsumer { void accept(DemTileReader.TileData tile) throws IOException; }
    synchronized long cachedBytes() { return bytes; }
}
