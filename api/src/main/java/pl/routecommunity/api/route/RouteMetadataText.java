package pl.routecommunity.api.route;

import org.springframework.http.HttpStatus;
import pl.routecommunity.api.common.error.ApiException;

/** Shared plain-text rules, including characters that can safely be exported as GPX XML. */
final class RouteMetadataText {
    private RouteMetadataText() { }
    static String name(String value) {
        if(value==null||value.isBlank()||value.trim().length()>200)throw invalid();
        return xmlText(value.trim());
    }
    static String description(String value) {
        if(value==null)return null;
        if(value.length()>10000)throw invalid();
        return value.isBlank()?null:xmlText(value.trim());
    }
    private static String xmlText(String value) {
        boolean invalid=value.codePoints().anyMatch(c->!(c==9||c==10||c==13||c>=0x20&&c<=0xd7ff||c>=0xe000&&c<=0xfffd||c>=0x10000&&c<=0x10ffff));
        if(invalid)throw invalid();
        return value;
    }
    private static ApiException invalid(){return new ApiException(HttpStatus.BAD_REQUEST,"Invalid route name or description");}
}
