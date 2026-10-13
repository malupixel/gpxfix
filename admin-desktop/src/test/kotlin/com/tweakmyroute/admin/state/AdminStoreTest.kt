package com.tweakmyroute.admin.state

import com.tweakmyroute.admin.api.*
import com.tweakmyroute.admin.preferences.ConnectionPreferences
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import kotlinx.coroutines.flow.first
import kotlin.test.*

@OptIn(ExperimentalCoroutinesApi::class)
class AdminStoreTest {
    private val secret = "1f".repeat(32)
    private fun store(api: TestRepository, dispatcher: CoroutineDispatcher) = AdminStore({ _, _ -> api }, dispatcher)

    @Test fun connectionAndSelectionOnlyUseTheCurrentPage() = runTest {
        val api = TestRepository()
        store(api, StandardTestDispatcher(testScheduler)).use { store ->
            store.connect("https://tweakmyroute.com", secret); advanceUntilIdle()
            assertTrue(store.state.value.authenticated); assertFalse(store.state.value.toString().contains(secret))
            store.navigate(Section.ROUTES); advanceUntilIdle()
            store.toggle(api.row); assertEquals(setOf(9L), store.state.value.selected)
            store.filterRoutes(RouteFilter(search = "other"), 1); advanceUntilIdle()
            assertTrue(store.state.value.selected.isEmpty()); assertEquals(1, store.state.value.routes?.page)
            store.disconnect(); assertFalse(store.state.value.authenticated); assertTrue(api.closed)
        }
    }

    @Test fun latestFilterCancelsPreviousRequestWithoutShowingAnError() = runTest {
        val api = TestRepository()
        store(api, StandardTestDispatcher(testScheduler)).use { store ->
            store.connect("https://tweakmyroute.com", secret); advanceUntilIdle()
            api.slowRoutes = true
            store.filterRoutes(RouteFilter(search = "slow")); runCurrent()
            store.filterRoutes(RouteFilter(search = "new")); advanceUntilIdle()
            assertEquals("new", store.state.value.routeFilter.search)
            assertEquals(1, api.cancelledReads); assertNull(store.state.value.error)
            assertFalse(store.state.value.busy)
        }
    }

    @Test fun unauthorizedResponseClosesClientAndClearsSensitiveData() = runTest {
        val api = TestRepository()
        store(api, StandardTestDispatcher(testScheduler)).use { store ->
            store.connect("https://tweakmyroute.com", secret); advanceUntilIdle()
            api.failure = ApiFailure(401, "Podaj sekret ponownie.")
            store.navigate(Section.ROUTES); advanceUntilIdle()
            assertFalse(store.state.value.authenticated); assertTrue(api.closed)
            assertNull(store.state.value.dashboard); assertNull(store.state.value.routes)
            assertEquals("Podaj sekret ponownie.", store.state.value.error)
        }
    }

    @Test fun failedMutationRemainsVisibleAfterStatusRefreshAndIsNotRetried() = runTest {
        val api = TestRepository()
        store(api, StandardTestDispatcher(testScheduler)).use { store ->
            store.connect("https://tweakmyroute.com", secret); advanceUntilIdle()
            store.openRoute(9); advanceUntilIdle()
            api.mutationFailure = ApiFailure(409, "Status się zmienił.")
            store.changeStatus(api.row, true, api.row.name); advanceUntilIdle()
            assertEquals(1, api.mutations); assertEquals("Status się zmienił.", store.state.value.error)
            assertFalse(store.state.value.mutating); assertFalse(store.state.value.busy)
            assertNotNull(store.state.value.details)
        }
    }

    @Test fun bulkRequiresExactSelectionAndInvalidDateNeverSendsRequest() = runTest {
        val api = TestRepository()
        store(api, StandardTestDispatcher(testScheduler)).use { store ->
            store.connect("https://tweakmyroute.com", secret); advanceUntilIdle()
            store.navigate(Section.ROUTES); advanceUntilIdle(); store.toggle(api.row)
            store.bulkDelete(listOf(10)); advanceUntilIdle(); assertEquals(0, api.mutations)
            store.bulkDelete(listOf(9)); advanceUntilIdle(); assertEquals(1, api.mutations); assertTrue(store.state.value.selected.isEmpty())
            val calls = api.reads
            store.filterRoutes(RouteFilter(from = "2026-13-99")); advanceUntilIdle()
            assertEquals(calls, api.reads); assertNotNull(store.state.value.error)
        }
    }

    @Test fun closingStoreCancelsAnActiveReadAndClosesRepository() = runTest {
        val api = TestRepository(); val store = store(api, StandardTestDispatcher(testScheduler))
        store.connect("https://tweakmyroute.com", secret); advanceUntilIdle()
        api.slowRoutes = true; store.filterRoutes(RouteFilter(search = "slow")); runCurrent()
        store.close(); advanceUntilIdle()
        assertTrue(api.closed); assertEquals(1, api.cancelledReads)
    }

    @Test fun onlyVerifiedCredentialsAreRememberedAndProfileSurvivesDisconnect() = runTest {
        val api = TestRepository()
        var saved: ConnectionProfile? = null
        val preferences = object : ConnectionPreferences {
            override fun load(profile: ConnectionProfile, baseUrl: String): String? = null
            override fun save(profile: ConnectionProfile, baseUrl: String, secret: String) { saved = profile }
            override fun forget(profile: ConnectionProfile) = Unit
        }
        AdminStore({ _, _ -> api }, StandardTestDispatcher(testScheduler), preferences).use { store ->
            store.selectProfile(ConnectionProfile.LOCAL)
            assertEquals(ConnectionProfile.LOCAL, store.state.value.profile)
            store.connectSelected(secret)
            store.state.first { it.authenticated && !it.busy }
            assertEquals(ConnectionProfile.LOCAL, saved)
            assertFalse(store.state.value.toString().contains(secret))
            store.disconnect()
            assertEquals(ConnectionProfile.LOCAL, store.state.value.profile)
        }
    }

    @Test fun authenticationFailureNeverOverwritesSavedCredentials() = runTest {
        val api = TestRepository().apply { loginFailure = ApiFailure(401, "Nieprawidłowy sekret.") }
        var saved = false
        val preferences = object : ConnectionPreferences {
            override fun load(profile: ConnectionProfile, baseUrl: String): String? = null
            override fun save(profile: ConnectionProfile, baseUrl: String, secret: String) { saved = true }
            override fun forget(profile: ConnectionProfile) = Unit
        }
        AdminStore({ _, _ -> api }, StandardTestDispatcher(testScheduler), preferences).use { store ->
            store.connectSelected(secret); advanceUntilIdle()
            assertFalse(saved); assertFalse(store.state.value.authenticated)
        }
    }

    @Test fun inabilityToRememberDoesNotBreakSuccessfulLogin() = runTest {
        val preferences = object : ConnectionPreferences {
            override fun load(profile: ConnectionProfile, baseUrl: String): String? = null
            override fun save(profile: ConnectionProfile, baseUrl: String, secret: String) { throw java.io.IOException("private diagnostic") }
            override fun forget(profile: ConnectionProfile) = Unit
        }
        AdminStore({ _, _ -> TestRepository() }, StandardTestDispatcher(testScheduler), preferences).use { store ->
            store.connectSelected(secret)
            store.state.first { it.authenticated && !it.busy }
            assertNotNull(store.state.value.notice)
            assertFalse(store.state.value.notice.orEmpty().contains("private diagnostic"))
        }
    }
}

/** Test fixture; the production client has no demo mode or fake-data fallback. */
private class TestRepository : AdminRepository {
    val row = RouteRow(9, "abc123", "Test route", "2026-10-13T10:00:00Z", "2026-10-13T10:00:00Z", 1.0, 1, 0)
    var closed = false
    var failure: ApiFailure? = null
    var loginFailure: ApiFailure? = null
    var mutationFailure: ApiFailure? = null
    var reads = 0
    var mutations = 0
    var slowRoutes = false
    var cancelledReads = 0
    override suspend fun dashboard() = Dashboard(1, 1, 0, 1, 1, 0, emptyMap(), 1, listOf(row), emptyList())
    override suspend fun system(): SystemStatus { loginFailure?.let { throw it }; return SystemStatus("UP", "test", true, 100, 1, 0, false) }
    override suspend fun routes(filter: RouteFilter, page: Int): Page<RouteRow> {
        reads++; failure?.let { throw it }
        if (slowRoutes && filter.search == "slow") try { delay(1000) } catch (cancelled: CancellationException) { cancelledReads++; throw cancelled }
        return Page(listOf(row), 50, page, 25)
    }
    override suspend fun details(id: Long) = RouteDetails(row, null, true, "GPX", 2, 4326, true, null, 0, 1, emptyList())
    override suspend fun versions(id: Long, page: Int) = Page<VersionRow>(emptyList(), 0, page, 25)
    override suspend fun activity(id: Long, page: Int) = Page<ActivityRow>(emptyList(), 0, page, 25)
    override suspend fun files(id: Long, page: Int) = Page<FileRow>(emptyList(), 0, page, 25)
    override suspend fun suggestions(status: String, search: String, page: Int, routeId: Long?) = Page<SuggestionRow>(emptyList(), 0, page, 25)
    override suspend fun deletePlan(id: Long) = DeletePlan(id, 1, 0, 0, 1, 1, 0, emptyList(), false, emptyList())
    override suspend fun changeStatus(route: RouteRow, deleted: Boolean, confirmation: String): MutationResult {
        mutations++; mutationFailure?.let { throw it }; return MutationResult(1)
    }
    override suspend fun bulkDelete(ids: List<Long>): MutationResult { mutations++; return MutationResult(ids.size) }
    override fun close() { closed = true }
}
