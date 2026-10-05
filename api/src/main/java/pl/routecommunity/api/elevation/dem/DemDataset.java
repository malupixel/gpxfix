package pl.routecommunity.api.elevation.dem;

import java.io.IOException;
import java.nio.file.*;
import java.util.Locale;
import pl.routecommunity.api.elevation.ElevationProvider.Coordinate;

/** One-degree WGS84, signed big-endian HGT tiles; elevations in metres. */
public class DemDataset {
    private final Path directory;

    public DemDataset(Path directory) {
        this.directory = directory.toAbsolutePath().normalize();
        if (!Files.isDirectory(this.directory) || !Files.isReadable(this.directory))
            throw new IllegalArgumentException("DEM directory is missing or unreadable: " + this.directory);
    }

    public Tile tileFor(Coordinate coordinate) throws IOException {
        double lat = coordinate.latitude(), lon = coordinate.longitude();
        if (!Double.isFinite(lat) || !Double.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)
            throw new IllegalArgumentException("Invalid elevation coordinate");
        int south = Math.min(89, (int) Math.floor(lat)), west = Math.min(179, (int) Math.floor(lon));
        Tile primary = new Tile(south, west);
        if (Files.isRegularFile(path(primary))) return primary;
        // HGT neighbours share edge nodes. An exact boundary can use either tile.
        if (lon == west && west > -180) {
            Tile neighbour = new Tile(south, west - 1);
            if (Files.isRegularFile(path(neighbour))) return neighbour;
        }
        if (lat == south && south > -90) {
            Tile neighbour = new Tile(south - 1, west);
            if (Files.isRegularFile(path(neighbour))) return neighbour;
            if (lon == west && west > -180) {
                neighbour = new Tile(south - 1, west - 1);
                if (Files.isRegularFile(path(neighbour))) return neighbour;
            }
        }
        throw new IOException("Missing DEM tile " + path(primary) + " for " + coordinate);
    }

    public Path path(Tile tile) { return directory.resolve(tile.filename()); }

    public record Tile(int south, int west) {
        public String filename() {
            return String.format(Locale.ROOT, "%s%02d%s%03d.hgt", south < 0 ? "S" : "N",
                    Math.abs(south), west < 0 ? "W" : "E", Math.abs(west));
        }
    }
}
