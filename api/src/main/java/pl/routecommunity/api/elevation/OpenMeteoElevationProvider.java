package pl.routecommunity.api.elevation;

import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.client.RestClient;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import pl.routecommunity.api.common.error.ApiException;

@Service
@ConditionalOnProperty(name="app.elevation.provider",havingValue="remote")
class OpenMeteoElevationProvider implements ElevationProvider {
    private static final int BATCH_SIZE=100,MAX_PARALLEL_REQUESTS=2,MAX_ATTEMPTS=3;
    private final RestClient client;private final ExecutorService executor=Executors.newFixedThreadPool(MAX_PARALLEL_REQUESTS,Thread.ofVirtual().name("elevation-",0).factory());
    OpenMeteoElevationProvider(RestClient.Builder builder,@Value("${app.elevation.base-url}") String baseUrl){SimpleClientHttpRequestFactory requests=new SimpleClientHttpRequestFactory();requests.setConnectTimeout(10_000);requests.setReadTimeout(30_000);client=builder.baseUrl(baseUrl).requestFactory(requests).build();}
    @Override public List<Double> elevations(List<Coordinate> coordinates){
        List<Callable<List<Double>>> calls=new ArrayList<>();for(int from=0;from<coordinates.size();from+=BATCH_SIZE){List<Coordinate> batch=List.copyOf(coordinates.subList(from,Math.min(from+BATCH_SIZE,coordinates.size())));calls.add(()->batch(batch));}
        try{List<Double> result=new ArrayList<>(coordinates.size());for(Future<List<Double>> future:executor.invokeAll(calls))result.addAll(future.get());return List.copyOf(result);}catch(InterruptedException exception){Thread.currentThread().interrupt();throw unavailable();}catch(ExecutionException exception){if(exception.getCause() instanceof ApiException apiException)throw apiException;throw unavailable();}
    }
    private List<Double> batch(List<Coordinate> batch){String latitudes=batch.stream().map(value->Double.toString(value.latitude())).collect(Collectors.joining(","));String longitudes=batch.stream().map(value->Double.toString(value.longitude())).collect(Collectors.joining(","));for(int attempt=1;attempt<=MAX_ATTEMPTS;attempt++){try{Response response=client.get().uri(builder->builder.path("/v1/elevation").queryParam("latitude",latitudes).queryParam("longitude",longitudes).build()).retrieve().body(Response.class);if(response!=null&&response.elevation()!=null&&response.elevation().size()==batch.size()&&response.elevation().stream().allMatch(value->value!=null&&Double.isFinite(value)))return response.elevation();}catch(Exception ignored){}if(attempt<MAX_ATTEMPTS)pause(attempt*300L);}throw unavailable();}
    private void pause(long milliseconds){try{Thread.sleep(milliseconds);}catch(InterruptedException exception){Thread.currentThread().interrupt();throw unavailable();}}
    @PreDestroy void close(){executor.shutdown();}
    private ApiException unavailable(){return new ApiException(HttpStatus.BAD_GATEWAY,"Elevation data is temporarily unavailable");}
    private record Response(List<Double> elevation){}
}
