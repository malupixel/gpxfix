package pl.routecommunity.api.route;

import jakarta.validation.constraints.NotNull;

public record ModerationRequest(@NotNull ModerationStatus moderationStatus) { }
