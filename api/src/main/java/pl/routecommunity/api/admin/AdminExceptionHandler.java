package pl.routecommunity.api.admin;

import java.time.Instant;
import java.util.Map;
import org.springframework.core.annotation.Order;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.dao.DataAccessException;

@Order(0)
@RestControllerAdvice(assignableTypes=AdminController.class)
class AdminExceptionHandler {
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<?> invalidParameter(Exception exception){return error(400,"Invalid administrative API parameter");}
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> databaseUnavailable(Exception exception){return error(503,"Administrative data temporarily unavailable");}
    private ResponseEntity<?> error(int status,String message){return ResponseEntity.status(status).body(Map.of("timestamp",Instant.now().toString(),"status",status,"error",message));}
}
