package com.tweakmyroute.admin

import com.tweakmyroute.admin.api.*
import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.request.forms.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.*
import java.io.File

/** Run only with an explicitly configured disposable backend at the fixed localhost smoke port. */
fun main() = runBlocking {
    val base = "http://127.0.0.1:18151"
    val secret = checkNotNull(System.getenv("TMR_ADMIN_SMOKE_SECRET")) { "Set TMR_ADMIN_SMOKE_SECRET for a disposable local backend." }
    HttpClient(CIO).use { public ->
        val ids = (1..2).map { number ->
            val response = public.submitFormWithBinaryData("$base/api/routes", formData {
                append("name", "Admin HTTP smoke test $number")
                append("file", File("../api/src/test/resources/gpx/valid.gpx").readBytes(), Headers.build {
                    append(HttpHeaders.ContentType, "application/gpx+xml")
                    append(HttpHeaders.ContentDisposition, "filename=admin-smoke.gpx")
                })
            })
            check(response.status == HttpStatusCode.Created) { "Local fixture upload failed: ${response.status.value}" }
            Json.parseToJsonElement(response.bodyAsText()).jsonObject.getValue("publicId").jsonPrimitive.content
        }
        AdminApi(base, secret).use { api ->
            check(api.system().databaseConnected)
            check(api.dashboard().totalRoutes >= 2)
            val page = api.routes(RouteFilter(search = "Admin HTTP smoke test", candidate = "TEST_NAME"), 0)
            check(page.items.size == 2)
            val route = page.items.first()
            val details = api.details(route.id)
            check(details.srid == 4326 && details.pointCount >= 2)
            check(api.versions(route.id, 0).total == 1L)
            check(api.files(route.id, 0).items.all { it.exists })
            check(api.activity(route.id, 0).total >= 1L)
            check(api.suggestions("ALL", route.publicId, 0).total == 0L)
            check(!api.deletePlan(route.id).executable)
            api.changeStatus(route, true, route.name)
            check(public.get("$base/api/routes/${route.publicId}").status == HttpStatusCode.NotFound)
            val deleted = api.details(route.id).route
            check(deleted.deletedAt != null)
            check(api.routes(RouteFilter(search = route.publicId, status = "DELETED"), 0).total == 1L)
            api.changeStatus(deleted, false, deleted.name)
            check(public.get("$base/api/routes/${route.publicId}").status == HttpStatusCode.OK)
            check(api.bulkDelete(page.items.map(RouteRow::id)).changed == 2)
            for (row in page.items) {
                val current = api.details(row.id).route
                check(current.deletedAt != null)
                api.changeStatus(current, false, current.name)
            }
            check(ids.all { id -> public.get("$base/api/routes/$id").status == HttpStatusCode.OK })
            println("HTTP smoke passed: real uploads, dashboard, pagination, details, files, activity, dry-run, soft delete, restore, bulk delete.")
        }
    }
}
