package pl.routecommunity.api.storage;
public interface FileStorage {
    String store(byte[] content);
    byte[] load(String storageKey);
    void delete(String storageKey);
}
