package pl.routecommunity.api.route;

record CreatedRoute(String publicId, String managementToken, String sessionToken) {
    CreateRouteResponse response() { return new CreateRouteResponse(publicId, managementToken); }
}
