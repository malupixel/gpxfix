package pl.routecommunity.api.elevation.dem;

import java.io.IOException;
import java.nio.*;
import java.nio.channels.FileChannel;
import java.nio.file.*;

public class DemTileReader {
    public TileData read(Path path) throws IOException {
        long bytes = Files.size(path);
        int size = bytes == 3601L * 3601 * 2 ? 3601 : bytes == 1201L * 1201 * 2 ? 1201 : 0;
        if (size == 0) throw new IOException("Unsupported HGT tile size: " + path + " (" + bytes + " bytes)");
        short[] heights = new short[size * size];
        try (FileChannel channel = FileChannel.open(path, StandardOpenOption.READ)) {
            ByteBuffer buffer = ByteBuffer.allocate(64 * 1024).order(ByteOrder.BIG_ENDIAN);
            int offset = 0;
            while (offset < heights.length) {
                buffer.clear();buffer.limit(Math.min(buffer.capacity(), (heights.length - offset) * 2));
                while (buffer.hasRemaining()) if (channel.read(buffer) < 0) throw new IOException("Truncated DEM tile: " + path);
                buffer.flip();ShortBuffer values = buffer.asShortBuffer();int count = values.remaining();
                values.get(heights, offset, count);offset += count;
            }
        }
        return new TileData(size, heights);
    }

    public record TileData(int size, short[] heights) {
        public long bytes() { return (long) heights.length * 2; }

        public double elevation(DemDataset.Tile tile, double latitude, double longitude) throws IOException {
            double row = Math.max(0, Math.min(size - 1, (tile.south() + 1 - latitude) * (size - 1)));
            double col = Math.max(0, Math.min(size - 1, (longitude - tile.west()) * (size - 1)));
            int y = (int) row, x = (int) col, nextY = Math.min(y + 1, size - 1), nextX = Math.min(x + 1, size - 1);
            double fy = row - y, fx = col - x;
            return weighted(y, x, (1 - fy) * (1 - fx)) + weighted(y, nextX, (1 - fy) * fx)
                    + weighted(nextY, x, fy * (1 - fx)) + weighted(nextY, nextX, fy * fx);
        }

        private double weighted(int row, int col, double weight) throws IOException {
            if (weight == 0) return 0;
            short value = heights[row * size + col];
            if (value == Short.MIN_VALUE) throw new IOException("DEM NoData at raster node " + row + "," + col);
            return value * weight;
        }
    }
}
