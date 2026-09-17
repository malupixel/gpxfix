package pl.routecommunity.api.storage;
public interface FileStorage {
    String store(byte[] content);
    void delete(String storageKey);
}
