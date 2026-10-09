package pl.routecommunity.api.route;

import java.io.IOException;
import java.nio.file.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
class RoutePreviewStore {
    private final Path root;
    RoutePreviewStore(@Value("${app.preview.storage-path:${app.storage.gpx-path}/previews}") Path root) {
        this.root = root.toAbsolutePath().normalize();
    }
    byte[] read(String revision) {
        try { return Files.readAllBytes(path(revision)); }
        catch (IOException e) { return null; }
    }
    boolean exists(String revision) { return Files.isRegularFile(path(revision)); }
    void write(String revision, byte[] png) throws IOException {
        Files.createDirectories(root);
        Path temp = Files.createTempFile(root, "preview-", ".tmp");
        try {
            Files.write(temp, png);
            Files.move(temp, path(revision), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } finally { Files.deleteIfExists(temp); }
    }
    private Path path(String revision) {
        if (!revision.matches("[a-f0-9]{64}")) throw new IllegalArgumentException("Invalid preview revision");
        return root.resolve(revision + ".png");
    }
}
