package pl.routecommunity.api.elevation.dem;

import java.io.IOException;
import java.nio.file.Path;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import pl.routecommunity.api.common.error.ApiException;
import pl.routecommunity.api.elevation.ElevationProvider;

@Service
@ConditionalOnProperty(name = "app.elevation.provider", havingValue = "local-dem", matchIfMissing = true)
public class DemElevationProvider implements ElevationProvider {
    private static final Logger log = LoggerFactory.getLogger(DemElevationProvider.class);
    private final DemDataset dataset;
    private final DemTileCache cache;

    @Override public String attribution() {
        return "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. "
                + "The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30.";
    }

    public DemElevationProvider(@Value("${app.elevation.data-path:/home/malupixel/data/elevation}") String path,
                                @Value("${app.elevation.cache-megabytes:128}") int cacheMegabytes) {
        dataset = new DemDataset(Path.of(path));
        cache = new DemTileCache(dataset, new DemTileReader(), Math.multiplyExact((long) cacheMegabytes, 1024 * 1024));
    }

    @Override public List<Double> elevations(List<Coordinate> coordinates) {
        Double[] result = new Double[coordinates.size()];
        Map<DemDataset.Tile, List<Integer>> groups = new LinkedHashMap<>();
        try {
            for (int i = 0; i < coordinates.size(); i++) groups.computeIfAbsent(dataset.tileFor(coordinates.get(i)), key -> new ArrayList<>()).add(i);
            for (var group : groups.entrySet()) cache.withTile(group.getKey(), tile -> {
                for (int i : group.getValue()) {
                    Coordinate point = coordinates.get(i);
                    try {
                        result[i] = tile.elevation(group.getKey(), point.latitude(), point.longitude());
                    } catch (IOException failure) {
                        throw new IOException(group.getKey().filename() + " at " + point + ": " + failure.getMessage(), failure);
                    }
                }
            });
            return List.copyOf(Arrays.asList(result));
        } catch (IOException failure) {
            log.error("Local DEM elevation failed: {}", failure.getMessage(), failure);
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Local elevation data is unavailable for this area. Please contact the administrator.");
        }
    }
}
