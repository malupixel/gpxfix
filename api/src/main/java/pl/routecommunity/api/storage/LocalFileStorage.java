package pl.routecommunity.api.storage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
@Component
public class LocalFileStorage implements FileStorage {
    private final Path root;
    public LocalFileStorage(@Value("${app.storage.gpx-path}") Path root) {
        this.root = root.toAbsolutePath().normalize();
        try { Files.createDirectories(this.root); }
        catch (IOException exception) { throw new IllegalStateException("Cannot create GPX storage directory", exception); }
    }
    public String store(byte[] content) {
        String key = UUID.randomUUID() + ".gpx";
        try { Files.write(root.resolve(key), content, StandardOpenOption.CREATE_NEW); return key; }
        catch (IOException exception) { throw new IllegalStateException("Cannot store GPX file", exception); }
    }
    public void delete(String storageKey) {
        try { Files.deleteIfExists(root.resolve(storageKey)); } catch (IOException ignored) { }
    }
}
