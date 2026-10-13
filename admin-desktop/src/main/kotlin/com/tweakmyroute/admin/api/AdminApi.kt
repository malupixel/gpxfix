package com.tweakmyroute.admin.api

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.Json
import java.io.Closeable

class ApiFailure(val status: Int?, message: String) : Exception(message)

interface AdminRepository : Closeable {
    suspend fun dashboard(): Dashboard
    suspend fun routes(filter: RouteFilter, page: Int): Page<RouteRow>
    suspend fun details(id: Long): RouteDetails
    suspend fun versions(id: Long, page: Int): Page<VersionRow>
    suspend fun activity(id: Long, page: Int): Page<ActivityRow>
    suspend fun files(id: Long, page: Int): Page<FileRow>
    suspend fun suggestions(status: String, search: String, page: Int, routeId: Long? = null): Page<SuggestionRow>
    suspend fun system(): SystemStatus
    suspend fun deletePlan(id: Long): DeletePlan
    suspend fun changeStatus(route: RouteRow, deleted: Boolean, confirmation: String): MutationResult
    suspend fun bulkDelete(ids: List<Long>): MutationResult
}

/** No logging plugin, redirects, persistent cookies, certificate overrides or implicit mutation retries. */
class AdminApi(rawBase: String, secret: String, engine: HttpClientEngine? = null) : AdminRepository {
    private val base = Connection.normalize(rawBase)
    private var credential: String? = secret.also(Connection::validateSecret)
    private val client = HttpClient(engine ?: CIO.create()) {
        followRedirects = false
        expectSuccess = false
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true; encodeDefaults = true }) }
        install(HttpTimeout) { requestTimeoutMillis = 30_000; connectTimeoutMillis = 10_000; socketTimeoutMillis = 30_000 }
        defaultRequest {
            header(HttpHeaders.Authorization, "Bearer ${credential.orEmpty()}")
            accept(ContentType.Application.Json)
        }
    }
    private suspend inline fun <reified T> request(path: String, method: HttpMethod = HttpMethod.Get,
        crossinline configure: HttpRequestBuilder.() -> Unit = {}): T {
        try {
            val response = client.request("$base/api/admin/$path") { this.method = method; configure() }
            if (!response.status.isSuccess()) throw ApiFailure(response.status.value, when (response.status.value) {
                401, 403 -> "Brak uprawnień administratora. Podaj sekret ponownie."
                409 -> "Status trasy zmienił się. Odśwież dane przed ponowną operacją."
                429 -> "Za dużo prób uwierzytelnienia. Odczekaj minutę."
                503 -> "API administracyjne jest wyłączone lub chwilowo niedostępne."
                in 300..399 -> "API zwróciło przekierowanie. Podaj bezpośredni adres HTTPS."
                400 -> "API odrzuciło parametry lub potwierdzenie operacji."
                404 -> "Nie znaleziono zasobu. Sprawdź adres API i wdrożenie backendu."
                else -> "Błąd API (${response.status.value})."
            })
            return response.body()
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (failure: ApiFailure) { throw failure }
        catch (_: Exception) { throw ApiFailure(null, "Nie udało się połączyć z API lub odczytać odpowiedzi. Sprawdź sieć, certyfikat i wersję backendu.") }
    }
    override suspend fun dashboard(): Dashboard = request("dashboard")
    override suspend fun routes(filter: RouteFilter, page: Int): Page<RouteRow> = request("routes") {
        parameter("page", page); parameter("size", 25)
        parameter("search", filter.search); parameter("status", filter.status); parameter("candidate", filter.candidate)
        parameter("sort", filter.sort); parameter("direction", filter.direction)
        if (filter.from.isNotBlank()) parameter("from", filter.from)
        if (filter.to.isNotBlank()) parameter("to", filter.to)
    }
    override suspend fun details(id: Long): RouteDetails = request("routes/$id")
    override suspend fun versions(id: Long, page: Int): Page<VersionRow> = request("routes/$id/versions") { parameter("page", page) }
    override suspend fun activity(id: Long, page: Int): Page<ActivityRow> = request("routes/$id/activity") { parameter("page", page) }
    override suspend fun files(id: Long, page: Int): Page<FileRow> = request("routes/$id/files") { parameter("page", page) }
    override suspend fun suggestions(status: String, search: String, page: Int, routeId: Long?): Page<SuggestionRow> = request("suggestions") {
        parameter("status", status); parameter("search", search); parameter("page", page)
        routeId?.let { parameter("routeId", it) }
    }
    override suspend fun system(): SystemStatus = request("system")
    override suspend fun deletePlan(id: Long): DeletePlan = request("routes/$id/permanent-delete-plan")
    override suspend fun changeStatus(route: RouteRow, deleted: Boolean, confirmation: String): MutationResult = request("routes/${route.id}/status", HttpMethod.Patch) {
        contentType(ContentType.Application.Json); setBody(StatusChange(deleted, route.deletedAt != null, confirmation))
    }
    override suspend fun bulkDelete(ids: List<Long>): MutationResult = request("routes/bulk-soft-delete", HttpMethod.Post) {
        contentType(ContentType.Application.Json); setBody(BulkDelete(ids))
    }
    override fun close() { credential = null; client.close() }
}
