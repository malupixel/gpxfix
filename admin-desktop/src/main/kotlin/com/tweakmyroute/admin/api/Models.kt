package com.tweakmyroute.admin.api

import kotlinx.serialization.Serializable

@Serializable data class Page<T>(val items: List<T>, val total: Long, val page: Int, val size: Int) {
    val hasNext: Boolean get() = (page.toLong() + 1) * size < total
}
@Serializable data class RouteRow(
    val id: Long, val publicId: String, val name: String, val createdAt: String, val updatedAt: String,
    val distanceKm: Double, val versionCount: Long, val suggestionCount: Long, val deletedAt: String? = null,
)
@Serializable data class SuggestionRow(
    val id: Long, val publicId: String, val routeId: Long, val routePublicId: String, val routeName: String,
    val type: String, val moderationStatus: String, val integrationStatus: String, val applicability: String,
    val description: String, val createdAt: String,
)
@Serializable data class VersionRow(
    val id: Long, val number: Int, val source: String, val createdAt: String, val distanceKm: Double,
    val originalFilename: String, val storageKey: String,
)
@Serializable data class ActivityRow(
    val id: String, val routeId: Long, val routePublicId: String, val type: String, val occurredAt: String, val actorKind: String,
)
@Serializable data class FileRow(val kind: String, val key: String, val exists: Boolean, val bytes: Long? = null)
@Serializable data class RouteDetails(
    val route: RouteRow, val description: String? = null, val suggestionsEnabled: Boolean,
    val sourceType: String? = null, val pointCount: Int, val srid: Int, val geometryValid: Boolean,
    val boundingBox: String? = null, val commentCount: Long, val activityCount: Long, val files: List<FileRow>,
    val originalUploadFilename: String? = null, val originalUploadStorageKey: String? = null,
)
@Serializable data class Dashboard(
    val totalRoutes: Long, val activeRoutes: Long, val deletedRoutes: Long, val created7Days: Long,
    val created30Days: Long, val totalSuggestions: Long, val suggestionStatuses: Map<String, Long>,
    val totalVersions: Long, val recentRoutes: List<RouteRow>, val recentActivity: List<ActivityRow>,
)
@Serializable data class SystemStatus(
    val apiStatus: String, val backendVersion: String, val databaseConnected: Boolean,
    val databaseBytes: Long, val referencedGpxFiles: Long, val previewRecords: Long, val permanentDeleteEnabled: Boolean,
)
@Serializable data class DeletePlan(
    val routeId: Long, val versions: Long, val suggestions: Long, val comments: Long, val activity: Long,
    val ownerSessions: Long, val previewJobs: Long, val files: List<FileRow>, val executable: Boolean,
    val warnings: List<String>,
)
@Serializable data class StatusChange(val deleted: Boolean, val expectedDeleted: Boolean, val confirmationName: String)
@Serializable data class BulkDelete(val routeIds: List<Long>, val confirmed: Boolean = true)
@Serializable data class MutationResult(val changed: Int)

data class RouteFilter(
    val search: String = "", val status: String = "ALL", val from: String = "", val to: String = "",
    val candidate: String = "ALL", val sort: String = "createdAt", val direction: String = "DESC",
)
