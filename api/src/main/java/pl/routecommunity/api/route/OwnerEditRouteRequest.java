package pl.routecommunity.api.route;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record OwnerEditRouteRequest(@Min(1) int baseVersionNumber,
        @NotNull @Size(min = 1, max = 200) String name, String description,
        @NotNull CreateDrawnRouteRequest.EditorDocument editorDocument) { }
