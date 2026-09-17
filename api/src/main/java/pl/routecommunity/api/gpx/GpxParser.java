package pl.routecommunity.api.gpx;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;
import org.springframework.stereotype.Component;

@Component
public class GpxParser {
    private static final double EARTH_RADIUS_METERS = 6_371_008.8;

    public GpxTrack parse(byte[] content) {
        XMLInputFactory factory = XMLInputFactory.newFactory();
        secure(factory, XMLInputFactory.SUPPORT_DTD, false);
        secure(factory, "javax.xml.stream.isSupportingExternalEntities", false);
        factory.setXMLResolver((publicId, systemId, baseUri, namespace) -> {
            throw new XMLStreamException("External XML resources are disabled");
        });
        List<List<GpxPoint>> segments = new ArrayList<>();
        List<GpxPoint> segment = null;
        PendingPoint point = null;
        try {
            XMLStreamReader reader = factory.createXMLStreamReader(new ByteArrayInputStream(content));
            while (reader.hasNext()) {
                int event = reader.next();
                if (event == XMLStreamConstants.DTD) throw new InvalidGpxException("GPX documents containing a DTD are not allowed");
                if (event == XMLStreamConstants.START_ELEMENT) {
                    switch (reader.getLocalName()) {
                        case "trkseg" -> segment = new ArrayList<>();
                        case "trkpt" -> point = readPoint(reader);
                        case "ele" -> { if (point != null) point.elevation = readElevation(reader); }
                        default -> { }
                    }
                } else if (event == XMLStreamConstants.END_ELEMENT) {
                    if ("trkpt".equals(reader.getLocalName()) && point != null && segment != null) {
                        segment.add(point.toPoint()); point = null;
                    } else if ("trkseg".equals(reader.getLocalName()) && segment != null) {
                        if (!segment.isEmpty()) segments.add(List.copyOf(segment));
                        segment = null;
                    }
                }
            }
            reader.close();
        } catch (InvalidGpxException exception) {
            throw exception;
        } catch (XMLStreamException | NumberFormatException exception) {
            throw new InvalidGpxException("The file is not valid GPX track data", exception);
        }
        if (segments.stream().mapToInt(List::size).sum() < 2) {
            throw new InvalidGpxException("The GPX file must contain at least two track points");
        }
        return calculateMetrics(segments);
    }

    private PendingPoint readPoint(XMLStreamReader reader) {
        String lat = reader.getAttributeValue(null, "lat");
        String lon = reader.getAttributeValue(null, "lon");
        if (lat == null || lon == null) throw new InvalidGpxException("Every GPX track point must have latitude and longitude");
        double latitude = Double.parseDouble(lat), longitude = Double.parseDouble(lon);
        if (!Double.isFinite(latitude) || !Double.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            throw new InvalidGpxException("GPX track point coordinates are outside valid bounds");
        }
        return new PendingPoint(latitude, longitude);
    }

    private Double readElevation(XMLStreamReader reader) throws XMLStreamException {
        String value = reader.getElementText().trim();
        if (value.isEmpty()) return null;
        double elevation = Double.parseDouble(value);
        if (!Double.isFinite(elevation)) throw new InvalidGpxException("GPX elevation must be a finite number");
        return elevation;
    }

    private GpxTrack calculateMetrics(List<List<GpxPoint>> segments) {
        double distance = 0, gain = 0;
        boolean elevationFound = false;
        for (List<GpxPoint> segment : segments) {
            for (int i = 1; i < segment.size(); i++) {
                GpxPoint previous = segment.get(i - 1), current = segment.get(i);
                distance += haversineMeters(previous, current);
                if (previous.elevationMeters() != null && current.elevationMeters() != null) {
                    elevationFound = true;
                    gain += Math.max(0, current.elevationMeters() - previous.elevationMeters());
                }
            }
        }
        return new GpxTrack(List.copyOf(segments), distance, elevationFound ? gain : null);
    }

    static double haversineMeters(GpxPoint first, GpxPoint second) {
        double lat1 = Math.toRadians(first.latitude()), lat2 = Math.toRadians(second.latitude());
        double deltaLat = lat2 - lat1, deltaLon = Math.toRadians(second.longitude() - first.longitude());
        double a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
                + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
    }

    private void secure(XMLInputFactory factory, String property, Object value) {
        try { factory.setProperty(property, value); }
        catch (IllegalArgumentException exception) { throw new IllegalStateException("The XML parser cannot be configured securely", exception); }
    }

    private static final class PendingPoint {
        private final double latitude, longitude;
        private Double elevation;
        private PendingPoint(double latitude, double longitude) { this.latitude = latitude; this.longitude = longitude; }
        private GpxPoint toPoint() { return new GpxPoint(latitude, longitude, elevation); }
    }
}
