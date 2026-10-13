package pl.routecommunity.api.admin;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import pl.routecommunity.api.common.error.ApiException;
import pl.routecommunity.api.route.AdminRouteMutationService;

@Service
public class AdminCommandService {
    private final AdminRouteMutationService domain;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    public AdminCommandService(AdminRouteMutationService domain,JdbcTemplate jdbc,PlatformTransactionManager manager) {
        this.domain=domain;this.jdbc=jdbc;transaction=new TransactionTemplate(manager);
    }
    public AdminDtos.MutationResult change(long id,AdminDtos.StatusChange request) {
        String operation=request.deleted()?"SOFT_DELETE":"RESTORE";
        execute(operation,List.of(id),()->domain.change(id,request.deleted(),request.expectedDeleted(),request.confirmationName()));
        return new AdminDtos.MutationResult(1);
    }
    public AdminDtos.MutationResult bulk(AdminDtos.BulkDelete request) {
        if(request.routeIds().stream().distinct().count()!=request.routeIds().size()) throw new ApiException(HttpStatus.BAD_REQUEST,"Duplicate route IDs");
        execute("BULK_SOFT_DELETE",request.routeIds(),()->domain.bulkDelete(request.routeIds()));
        return new AdminDtos.MutationResult(request.routeIds().size());
    }
    private void execute(String operation,List<Long> ids,Runnable command) {
        try {
            transaction.executeWithoutResult(status->{command.run();ids.forEach(id->audit(operation,id,"SUCCESS"));});
        } catch(RuntimeException failure) {
            // The failed business transaction has rolled back; record only safe identifiers/result.
            transaction.executeWithoutResult(status->ids.forEach(id->audit(operation,id,failure instanceof ApiException?"REJECTED":"FAILED")));
            throw failure;
        }
    }
    private void audit(String operation,long id,String result) {
        jdbc.update("INSERT INTO admin_audit(operation,resource_id,result) VALUES (?,?,?)",operation,id,result);
    }
}
