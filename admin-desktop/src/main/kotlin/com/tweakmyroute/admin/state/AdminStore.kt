package com.tweakmyroute.admin.state

import com.tweakmyroute.admin.api.*
import com.tweakmyroute.admin.preferences.ConnectionPreferences
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import java.io.Closeable
import java.time.LocalDate

/** Desktop ViewModel equivalent. One cancellable read at a time, mutations explicitly confirmed in UI. */
class AdminStore(
    private val factory: (String, String) -> AdminRepository = { url, secret -> AdminApi(url, secret) },
    dispatcher: CoroutineDispatcher = Dispatchers.Main,
    private val preferences: ConnectionPreferences? = null,
) : Closeable {
    private val scope = CoroutineScope(SupervisorJob() + dispatcher)
    private val mutable = MutableStateFlow(AdminState())
    val state: StateFlow<AdminState> = mutable.asStateFlow()
    private var repository: AdminRepository? = null
    private var readJob: Job? = null

    fun selectProfile(profile: ConnectionProfile) {
        if (state.value.busy || state.value.authenticated) return
        mutable.value = AdminState(profile = profile)
    }

    suspend fun rememberedSecret(profile: ConnectionProfile): String? = withContext(Dispatchers.IO) {
        preferences?.load(profile, profile.apiUrl())
    }

    suspend fun forgetSecret(profile: ConnectionProfile) = withContext(Dispatchers.IO) { preferences?.forget(profile) }

    fun connectSelected(secret: String) = connect(state.value.profile.apiUrl(), secret, remember = true)

    fun connect(url: String, secret: String, remember: Boolean = false) {
        if (state.value.busy) return
        try {
            val base = Connection.normalize(url)
            val profile = state.value.profile
            if (remember) profile.validateUrl(base)
            Connection.validateSecret(secret)
            repository?.close()
            repository = factory(base, secret)
            mutable.value = AdminState(profile = profile, baseUrl = base, busy = true)
            load {
                val api = api()
                val system = api.system()
                val dashboard = api.dashboard()
                var notice: String? = null
                if (remember && preferences != null) {
                    try { withContext(Dispatchers.IO) { preferences.save(profile, base, secret) } }
                    catch (cancelled: CancellationException) { throw cancelled }
                    catch (_: Exception) { notice = "Połączono, ale nie udało się zapisać sekretu na tym komputerze." }
                }
                mutable.update { it.copy(authenticated = true, apiOnline = true, system = system, dashboard = dashboard, notice = notice) }
            }
        } catch (_: Exception) {
            mutable.update { it.copy(error = "Sprawdź adres API (HTTPS, lokalnie 127.0.0.1) i format sekretu: 64 małe znaki hex.", busy = false) }
        }
    }

    fun disconnect() {
        if (state.value.mutating) return
        readJob?.cancel()
        repository?.close(); repository = null
        mutable.value = AdminState(profile = state.value.profile, baseUrl = state.value.baseUrl)
    }

    fun navigate(section: Section) {
        if (state.value.mutating) return
        mutable.update { it.copy(section = section, details = null, selected = emptySet(), notice = null) }
        refresh()
    }

    fun refresh(clearError: Boolean = true) {
        if (state.value.mutating || !state.value.authenticated) return
        val snapshot = state.value
        load(clearError) {
            val api = api()
            if (snapshot.details != null) {
                val details = api.details(snapshot.details.route.id)
                mutable.update { it.copy(details = details) }
                loadTab(api, details.route.id, snapshot.detailTab, 0)
            } else when (snapshot.section) {
                Section.DASHBOARD -> { val data = api.dashboard(); mutable.update { it.copy(dashboard = data) } }
                Section.ROUTES -> { val data = api.routes(snapshot.routeFilter, snapshot.routes?.page ?: 0); mutable.update { it.copy(routes = data, selected = emptySet()) } }
                Section.SUGGESTIONS -> { val data = api.suggestions(snapshot.suggestionStatus, snapshot.suggestionSearch, snapshot.suggestions?.page ?: 0); mutable.update { it.copy(suggestions = data) } }
                Section.SYSTEM -> { val data = api.system(); mutable.update { it.copy(system = data) } }
                Section.SETTINGS -> { val data = api.system(); mutable.update { it.copy(system = data) } }
            }
        }
    }

    fun filterRoutes(filter: RouteFilter, page: Int = 0) {
        if (state.value.mutating) return
        try {
            val from = filter.from.takeIf(String::isNotBlank)?.let(LocalDate::parse)
            val to = filter.to.takeIf(String::isNotBlank)?.let(LocalDate::parse)
            require(from == null || to == null || from <= to)
        } catch (_: Exception) {
            mutable.update { it.copy(error = "Zakres dat jest niepoprawny. Użyj formatu RRRR-MM-DD; daty są liczone w UTC.") }; return
        }
        mutable.update { it.copy(routeFilter = filter, selected = emptySet(), routes = null) }
        load { val rows = api().routes(filter, page); mutable.update { it.copy(routes = rows) } }
    }

    fun filterSuggestions(status: String, search: String, page: Int = 0) {
        if (state.value.mutating) return
        mutable.update { it.copy(suggestionStatus = status, suggestionSearch = search, suggestions = null) }
        load { val rows = api().suggestions(status, search, page); mutable.update { it.copy(suggestions = rows) } }
    }

    fun openRoute(id: Long) {
        if (state.value.mutating) return
        mutable.update { it.copy(section = Section.ROUTES, details = null, detailTab = DetailTab.METADATA,
            versions = null, routeSuggestions = null, activity = null, files = null, deletePlan = null, selected = emptySet()) }
        load { val details = api().details(id); mutable.update { it.copy(details = details) } }
    }

    fun tab(tab: DetailTab, page: Int = 0) {
        if (state.value.mutating) return
        val id = state.value.details?.route?.id ?: return
        mutable.update { it.copy(detailTab = tab, versions = null, routeSuggestions = null, activity = null, files = null, deletePlan = null) }
        load { loadTab(api(), id, tab, page) }
    }
    private suspend fun loadTab(api: AdminRepository, id: Long, tab: DetailTab, page: Int) {
        when (tab) {
            DetailTab.METADATA -> Unit
            DetailTab.VERSIONS -> { val rows = api.versions(id, page); mutable.update { it.copy(versions = rows) } }
            DetailTab.SUGGESTIONS -> { val rows = api.suggestions("ALL", "", page, id); mutable.update { it.copy(routeSuggestions = rows) } }
            DetailTab.ACTIVITY -> { val rows = api.activity(id, page); mutable.update { it.copy(activity = rows) } }
            DetailTab.FILES -> { val rows = api.files(id, page); mutable.update { it.copy(files = rows) } }
            DetailTab.DELETE_PLAN -> { val plan = api.deletePlan(id); mutable.update { it.copy(deletePlan = plan) } }
        }
    }

    fun toggle(row: RouteRow) {
        if (state.value.busy || state.value.mutating || row.deletedAt != null) return
        mutable.update { it.copy(selected = if (row.id in it.selected) it.selected - row.id else it.selected + row.id) }
    }
    fun clearSelection() { mutable.update { it.copy(selected = emptySet()) } }
    fun changeStatus(row: RouteRow, deleted: Boolean, confirmation: String) {
        if (confirmation != row.name) return
        mutate { api -> api.changeStatus(row, deleted, confirmation) }
    }
    fun bulkDelete(ids: List<Long>) {
        if (ids.isEmpty() || ids.size > 100 || ids.toSet() != state.value.selected) return
        mutate { api -> api.bulkDelete(ids) }
    }
    private fun mutate(command: suspend (AdminRepository) -> MutationResult) {
        if (state.value.busy || state.value.mutating) return
        readJob?.cancel()
        mutable.update { it.copy(mutating = true, error = null, notice = null) }
        scope.launch {
            try {
                val result = command(api())
                mutable.update { it.copy(selected = emptySet(), notice = "Zapisano zmianę dla ${result.changed} tras.") }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (failure: Exception) {
                handleFailure(failure)
                if (failure is ApiFailure && failure.status == null) mutable.update { it.copy(error = "Nie potwierdzono wyniku operacji. Sprawdź odświeżony status tras przed kolejną zmianą.") }
            }
            finally { mutable.update { it.copy(mutating = false) } }
            refresh(clearError = false)
        }
    }
    private fun load(clearError: Boolean = true, action: suspend () -> Unit) {
        readJob?.cancel()
        readJob = scope.launch {
            mutable.update { it.copy(busy = true, error = if (clearError) null else it.error) }
            try { action(); mutable.update { it.copy(apiOnline = true) } }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (failure: Exception) { handleFailure(failure) }
            finally { if (currentCoroutineContext().isActive) mutable.update { it.copy(busy = false) } }
        }
    }
    private fun handleFailure(failure: Exception) {
        if (failure is ApiFailure && failure.status in listOf(401, 403)) {
            repository?.close(); repository = null
            mutable.value = AdminState(profile = state.value.profile, baseUrl = state.value.baseUrl, error = failure.message)
        } else mutable.update { it.copy(apiOnline = if (failure is ApiFailure && failure.status != null && failure.status < 500) it.apiOnline else false,
            error = (failure as? ApiFailure)?.message ?: "Nie udało się odczytać danych. Spróbuj odświeżyć widok.") }
    }
    private fun api(): AdminRepository = checkNotNull(repository)
    override fun close() { scope.cancel(); repository?.close(); repository = null }
}
