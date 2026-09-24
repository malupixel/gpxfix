package pl.routecommunity.api.route;

public enum ModerationStatus {
    PENDING, PUBLISHED, REJECTED;

    void requirePending() {
        if (this != PENDING) throw new IllegalStateException("Only pending content can be moderated");
    }
}
