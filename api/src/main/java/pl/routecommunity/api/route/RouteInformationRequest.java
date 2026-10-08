package pl.routecommunity.api.route;
import jakarta.validation.constraints.*;
import java.time.Instant;
public record RouteInformationRequest(@NotBlank @Size(max=200) String name,@Size(max=10000) String description,@NotNull Instant expectedUpdatedAt) { }
