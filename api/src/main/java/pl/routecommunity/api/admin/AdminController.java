package pl.routecommunity.api.admin;

import static pl.routecommunity.api.admin.AdminDtos.*;
import jakarta.validation.Valid;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AdminQueryService queries;
    private final AdminCommandService commands;
    public AdminController(AdminQueryService queries,AdminCommandService commands) {this.queries=queries;this.commands=commands;}
    @GetMapping("/dashboard") Dashboard dashboard(){return queries.dashboard();}
    @GetMapping("/system") SystemStatus system(){return queries.system();}
    @GetMapping("/routes") Page<RouteRow> routes(
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="25") int size,
        @RequestParam(defaultValue="") String search,@RequestParam(defaultValue="ALL") String status,
        @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,
        @RequestParam(defaultValue="ALL") String candidate,@RequestParam(defaultValue="createdAt") String sort,
        @RequestParam(defaultValue="DESC") String direction) {return queries.routes(page,size,search,status,from,to,candidate,sort,direction);}
    @GetMapping("/routes/{id}") RouteDetails details(@PathVariable long id){return queries.details(id);}
    @GetMapping("/routes/{id}/versions") Page<VersionRow> versions(@PathVariable long id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="25") int size){return queries.versions(id,page,size);}
    @GetMapping("/routes/{id}/activity") Page<ActivityRow> activity(@PathVariable long id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="25") int size){return queries.activity(id,page,size);}
    @GetMapping("/routes/{id}/files") Page<FileRow> files(@PathVariable long id,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="25") int size){queries.route(id);return queries.files(id,page,size);}
    @GetMapping("/routes/{id}/permanent-delete-plan") DeletePlan plan(@PathVariable long id){return queries.deletePlan(id);}
    @PatchMapping("/routes/{id}/status") MutationResult status(@PathVariable long id,@Valid @RequestBody StatusChange body){return commands.change(id,body);}
    @PostMapping("/routes/bulk-soft-delete") MutationResult bulk(@Valid @RequestBody BulkDelete body){return commands.bulk(body);}
    @GetMapping("/suggestions") Page<SuggestionRow> suggestions(
        @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="25") int size,
        @RequestParam(defaultValue="ALL") String status,@RequestParam(defaultValue="") String search,
        @RequestParam(required=false) Long routeId){return queries.suggestions(page,size,status,search,routeId);}
    // Deliberately no DELETE mapping, enable flag, or storage-deleting command.
}
