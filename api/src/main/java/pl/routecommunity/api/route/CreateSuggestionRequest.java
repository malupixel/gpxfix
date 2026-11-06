package pl.routecommunity.api.route;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public record CreateSuggestionRequest(
        Integer baseVersionNumber,
        @NotNull SuggestionType type,
        @NotBlank @Size(max=80) String authorName,
        @NotBlank @Size(max=2000) String description,
        @Size(max=40) String category,
        @Size(max=6) List<@NotBlank @Size(max=40) String> tags,
        @NotNull @Valid Anchor start,
        @Valid Anchor end,
        @Valid LineStringGeometry proposedGeometry) {
    public CreateSuggestionRequest(SuggestionType type,String authorName,String description,String category,List<String> tags,Anchor start,Anchor end,LineStringGeometry proposedGeometry){this(null,type,authorName,description,category,tags,start,end,proposedGeometry);}
    public record Anchor(@NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
                         @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
                         @NotNull @PositiveOrZero Double distanceMeters) { }
    public record LineStringGeometry(@NotBlank String type,
            @NotNull @Size(min=2,max=500) List<@NotNull @Size(min=2,max=2) List<@NotNull Double>> coordinates) { }
}
