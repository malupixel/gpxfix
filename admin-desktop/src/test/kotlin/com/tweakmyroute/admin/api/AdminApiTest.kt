package com.tweakmyroute.admin.api

import io.ktor.client.engine.mock.*
import io.ktor.http.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.*
import kotlin.test.*

class AdminApiTest {
    private val secret = "a1".repeat(32)
    private val headers = headersOf(HttpHeaders.ContentType, "application/json")
    private val routeJson = """{"id":9,"publicId":"abc123","name":"Test Łódź","createdAt":"2026-10-13T10:00:00Z","updatedAt":"2026-10-13T10:00:00Z","distanceKm":0.8,"versionCount":2,"suggestionCount":1,"deletedAt":null}"""

    @Test fun validatesTransportBeforeCredentialsCanBeSent() {
        listOf("http://tweakmyroute.com", "http://127.0.0.1.evil.test", "http://localhost", "ftp://server", "https://user:secret@server", "https://server?key=value", "https://server/api", "https://server#fragment").forEach {
            assertFailsWith<IllegalArgumentException> { Connection.normalize(it) }
        }
        assertEquals("https://tweakmyroute.com", Connection.normalize(" https://tweakmyroute.com/ "))
        assertEquals("http://127.0.0.1:8151", Connection.normalize("http://127.0.0.1:8151"))
        assertEquals("http://[::1]:8151", Connection.normalize("http://[::1]:8151"))
    }

    @Test fun paginatedRoutesSerializeDatesAndEncodeFilters() = runTest {
        val engine = MockEngine { request ->
            assertEquals("Bearer $secret", request.headers[HttpHeaders.Authorization])
            assertEquals("/api/admin/routes", request.url.encodedPath)
            assertEquals("test & Łódź", request.url.parameters["search"])
            assertEquals("3", request.url.parameters["page"])
            assertEquals("DELETED", request.url.parameters["status"])
            respond("""{"items":[$routeJson],"total":101,"page":3,"size":25,"futureField":true}""", headers = headers)
        }
        AdminApi("https://tweakmyroute.com", secret, engine).use { api ->
            val page = api.routes(RouteFilter(search = "test & Łódź", status = "DELETED"), 3)
            assertEquals("Test Łódź", page.items.single().name)
            assertNull(page.items.single().deletedAt)
            assertTrue(page.hasNext)
        }
    }

    @Test fun sendsExplicitStatusAndBulkConfirmationWithoutRetrying() = runTest {
        var calls = 0
        val engine = MockEngine { request ->
            calls++
            val body = Json.parseToJsonElement((request.body as io.ktor.http.content.TextContent).text).jsonObject
            if (calls == 1) {
                assertEquals(HttpMethod.Patch, request.method)
                assertEquals(false, body["expectedDeleted"]!!.jsonPrimitive.boolean)
                assertEquals(true, body["deleted"]!!.jsonPrimitive.boolean)
                assertEquals("Test Łódź", body["confirmationName"]!!.jsonPrimitive.content)
            } else {
                assertEquals(HttpMethod.Post, request.method)
                assertEquals(true, body["confirmed"]!!.jsonPrimitive.boolean)
                assertEquals(2, body["routeIds"]!!.jsonArray.size)
            }
            respond("""{"changed":1}""", headers = headers)
        }
        AdminApi("https://tweakmyroute.com", secret, engine).use { api ->
            val route = Json.decodeFromString<RouteRow>(routeJson)
            api.changeStatus(route, true, route.name); api.bulkDelete(listOf(9, 10))
        }
        assertEquals(2, calls)
    }

    @Test fun redirectsAndUnauthorizedResponsesNeverLeakResponseBodyOrSecret() = runTest {
        for (status in listOf(HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden, HttpStatusCode.TooManyRequests, HttpStatusCode.Found)) {
            var calls = 0
            val engine = MockEngine {
                calls++
                respond("sensitive body $secret", status, headersOf(HttpHeaders.Location, "http://evil.test"))
            }
            AdminApi("https://tweakmyroute.com", secret, engine).use { api ->
                val failure = assertFailsWith<ApiFailure> { api.system() }
                assertEquals(status.value, failure.status)
                assertFalse(failure.message.orEmpty().contains(secret))
            }
            assertEquals(1, calls)
        }
    }

    @Test fun cancellationIsNotConvertedToNetworkFailure() = runTest {
        val engine = MockEngine { throw CancellationException("cancelled") }
        AdminApi("https://tweakmyroute.com", secret, engine).use { api -> assertFailsWith<CancellationException> { api.dashboard() } }
    }
    @Test fun malformedPayloadHasSafeErrorAndNoInfrastructureDetails() = runTest {
        val engine = MockEngine { respond("<html>proxy failure</html>", headers = headers) }
        AdminApi("https://tweakmyroute.com", secret, engine).use { api ->
            val failure = assertFailsWith<ApiFailure> { api.system() }
            assertNull(failure.status); assertFalse(failure.message.orEmpty().contains("proxy failure"))
        }
    }
}
