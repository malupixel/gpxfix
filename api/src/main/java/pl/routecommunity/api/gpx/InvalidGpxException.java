package pl.routecommunity.api.gpx;
public class InvalidGpxException extends RuntimeException {
    public InvalidGpxException(String message) { super(message); }
    public InvalidGpxException(String message, Throwable cause) { super(message, cause); }
}
