package pl.routecommunity.api.common.error;
import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ApiException.class)
    ResponseEntity<Map<String,Object>> handleApi(ApiException exception){return error(exception.status(),exception.getMessage());}
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<Map<String,Object>> handleTooLarge(MaxUploadSizeExceededException exception){return error(HttpStatus.PAYLOAD_TOO_LARGE,"The uploaded GPX file is too large");}
    @ExceptionHandler({MethodArgumentNotValidException.class,MissingServletRequestParameterException.class})
    ResponseEntity<Map<String,Object>> handleValidation(Exception exception){return error(HttpStatus.BAD_REQUEST,"Validation failed: "+exception.getMessage());}
    private ResponseEntity<Map<String,Object>> error(HttpStatus status,String message){return ResponseEntity.status(status).body(Map.of("timestamp",Instant.now().toString(),"status",status.value(),"error",message));}
}
