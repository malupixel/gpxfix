package pl.routecommunity.api.route;
import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.stereotype.Component;
@Component
class PublicIdGenerator {
    private final SecureRandom random=new SecureRandom();
    String next(){byte[] bytes=new byte[7];random.nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
}
