package com.tweakmyroute.admin.state

import com.tweakmyroute.admin.api.*

enum class Section { DASHBOARD, ROUTES, SUGGESTIONS, SYSTEM, SETTINGS }
enum class DetailTab { METADATA, VERSIONS, SUGGESTIONS, ACTIVITY, FILES, DELETE_PLAN }

data class AdminState(
    val profile: ConnectionProfile = ConnectionProfile.initial(),
    val baseUrl: String = profile.apiUrl(),
    val authenticated: Boolean = false,
    val busy: Boolean = false,
    val mutating: Boolean = false,
    val apiOnline: Boolean = false,
    val error: String? = null,
    val notice: String? = null,
    val section: Section = Section.DASHBOARD,
    val dashboard: Dashboard? = null,
    val system: SystemStatus? = null,
    val routeFilter: RouteFilter = RouteFilter(),
    val routes: Page<RouteRow>? = null,
    val selected: Set<Long> = emptySet(),
    val suggestionStatus: String = "ALL",
    val suggestionSearch: String = "",
    val suggestions: Page<SuggestionRow>? = null,
    val details: RouteDetails? = null,
    val detailTab: DetailTab = DetailTab.METADATA,
    val versions: Page<VersionRow>? = null,
    val routeSuggestions: Page<SuggestionRow>? = null,
    val activity: Page<ActivityRow>? = null,
    val files: Page<FileRow>? = null,
    val deletePlan: DeletePlan? = null,
)
