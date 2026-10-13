package com.tweakmyroute.admin.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.tweakmyroute.admin.api.*
import com.tweakmyroute.admin.state.*

@Composable fun RouteDetailsScreen(state: AdminState, store: AdminStore) {
    val details = state.details ?: return
    val row = details.route
    val locked = state.busy || state.mutating
    var confirmStatus by remember(row.id) { mutableStateOf(false) }
    var browserError by remember(row.id) { mutableStateOf<String?>(null) }
    val uriHandler = LocalUriHandler.current
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TextButton(onClick = { store.navigate(Section.ROUTES) }, enabled = !locked) { Text("← Lista") }
            Column(Modifier.weight(1f)) {
                Text(row.name.ifBlank { "Bez nazwy" }, style = MaterialTheme.typography.titleLarge)
                Text("#${row.id} · ${row.publicId}", color = Muted)
            }
            Badge(if (row.deletedAt == null) "Aktywna" else "Usunięta", if (row.deletedAt == null) Accent else Danger)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = {
                runCatching {
                    val site = Connection.normalize(System.getenv("TMR_ADMIN_PUBLIC_URL") ?: state.profile.defaultPublicUrl)
                    require(row.publicId.matches(Regex("[A-Za-z0-9_-]{1,12}")))
                    uriHandler.openUri("$site/route/${row.publicId}")
                }.onFailure { browserError = "Nie udało się otworzyć przeglądarki. Public ID trasy: ${row.publicId}." }
            }) { Text("Otwórz stronę trasy ↗") }
            OutlinedButton(onClick = { confirmStatus = true }, enabled = !locked) {
                Text(if (row.deletedAt == null) "Soft delete" else "Przywróć trasę", color = if (row.deletedAt == null) Danger else Accent)
            }
        }
        browserError?.let { Message(it, true) }
        if (row.deletedAt != null) Text("Usunięta trasa zwróci 404 na publicznej stronie, dopóki jej nie przywrócisz.", color = Muted, style = MaterialTheme.typography.bodySmall)
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DetailTab.entries.forEach { tab -> FilterChip(selected = state.detailTab == tab, onClick = { store.tab(tab) }, enabled = !locked, label = { Text(Pl.label(tab.name)) }) }
        }
        Box(Modifier.weight(1f)) {
            when (state.detailTab) {
                DetailTab.METADATA -> Metadata(details)
                DetailTab.VERSIONS -> Column {
                    VersionList(state.versions, Modifier.weight(1f))
                    Pager(state.versions, locked) { store.tab(DetailTab.VERSIONS, it) }
                }
                DetailTab.SUGGESTIONS -> Column {
                    SuggestionList(state.routeSuggestions, store::openRoute, Modifier.weight(1f))
                    Pager(state.routeSuggestions, locked) { store.tab(DetailTab.SUGGESTIONS, it) }
                }
                DetailTab.ACTIVITY -> Column {
                    Panel(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())) { ActivityItems(state.activity?.items.orEmpty()) }
                    Pager(state.activity, locked) { store.tab(DetailTab.ACTIVITY, it) }
                }
                DetailTab.FILES -> Column {
                    FileList(state.files, Modifier.weight(1f))
                    Pager(state.files, locked) { store.tab(DetailTab.FILES, it) }
                }
                DetailTab.DELETE_PLAN -> DeletePlanScreen(state.deletePlan)
            }
        }
    }
    if (confirmStatus) StatusDialog(row, locked, { confirmStatus = false }) { confirmation ->
        confirmStatus = false; store.changeStatus(row, row.deletedAt == null, confirmation)
    }
}

@Composable private fun Metadata(details: RouteDetails) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Panel(Modifier.fillMaxWidth()) {
            Text("Metadane", style = MaterialTheme.typography.titleMedium)
            KeyValue("Utworzenie", date(details.route.createdAt)); KeyValue("Aktualizacja", date(details.route.updatedAt))
            KeyValue("Soft delete", date(details.route.deletedAt)); KeyValue("Sugestie", if (details.suggestionsEnabled) "Włączone" else "Wyłączone")
            KeyValue("Długość", km(details.route.distanceKm)); KeyValue("Źródło", details.sourceType ?: "Brak wersji")
            KeyValue("Wersje", details.route.versionCount.toString()); KeyValue("Sugestie", details.route.suggestionCount.toString())
            KeyValue("Komentarze sugestii", details.commentCount.toString()); KeyValue("Zdarzenia aktywności", details.activityCount.toString())
            KeyValue("Oryginalny GPX", details.originalUploadFilename ?: "Brak referencji do oryginału")
            details.originalUploadStorageKey?.let { KeyValue("Klucz oryginału", it) }
        }
        Panel(Modifier.fillMaxWidth()) {
            Text("Geometria", style = MaterialTheme.typography.titleMedium)
            KeyValue("Liczba punktów", details.pointCount.toString()); KeyValue("SRID", details.srid.toString())
            KeyValue("Poprawność", if (details.geometryValid) "Poprawna" else "Wymaga przeglądu")
            KeyValue("Obwiednia", details.boundingBox ?: "Brak")
        }
        Panel(Modifier.fillMaxWidth()) { Text("Opis trasy", style = MaterialTheme.typography.titleMedium); Text(details.description?.takeIf(String::isNotBlank) ?: "Brak opisu.", color = Muted) }
    }
}
@Composable private fun VersionList(page: Page<VersionRow>?, modifier: Modifier) {
    if (page == null) { Empty("Oczekiwanie na wersje…"); return }
    if (page.items.isEmpty()) { Empty(); return }
    LazyColumn(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(page.items, key = VersionRow::id) { version -> Panel(Modifier.fillMaxWidth()) {
            Row { Text("Wersja ${version.number} · ${Pl.label(version.source)}", modifier = Modifier.weight(1f)); Text(km(version.distanceKm), color = Accent) }
            Text("${date(version.createdAt)} · ID ${version.id}", color = Muted)
            KeyValue("Nazwa pliku", version.originalFilename); KeyValue("Klucz storage", version.storageKey)
        } }
    }
}
@Composable private fun FileList(page: Page<FileRow>?, modifier: Modifier) {
    if (page == null) { Empty("Oczekiwanie na pliki…"); return }
    if (page.items.isEmpty()) { Empty("Brak referencji do plików."); return }
    LazyColumn(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(page.items, key = { "${it.kind}:${it.key}" }) { file -> Panel(Modifier.fillMaxWidth()) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Badge(if (file.kind == "GPX") "GPX" else "Podgląd PNG")
                Badge(if (file.exists) "Istnieje" else "Brak / niedostępny", if (file.exists) Accent else Danger)
                Text(bytes(file.bytes), color = Muted)
            }
            Text(file.key, style = MaterialTheme.typography.bodySmall)
        } }
    }
}
@Composable private fun DeletePlanScreen(plan: DeletePlan?) {
    if (plan == null) { Empty("Oczekiwanie na dry-run…"); return }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Message("Permanent delete jest wyłączone. To podsumowanie tylko do odczytu; żadne dane ani pliki nie zostaną usunięte.")
        Panel(Modifier.fillMaxWidth()) {
            KeyValue("Wersje", plan.versions.toString()); KeyValue("Sugestie", plan.suggestions.toString()); KeyValue("Komentarze", plan.comments.toString())
            KeyValue("Aktywność", plan.activity.toString()); KeyValue("Sesje właściciela", plan.ownerSessions.toString()); KeyValue("Zadania podglądów", plan.previewJobs.toString())
            Text("Pliki w podsumowaniu (${plan.files.size})", style = MaterialTheme.typography.titleSmall)
            plan.files.forEach { Text("${it.kind} · ${it.key} · ${if (it.exists) bytes(it.bytes) else "brak / niedostępny"}", color = Muted, style = MaterialTheme.typography.bodySmall) }
        }
        Panel(Modifier.fillMaxWidth()) { Text("Uwagi do osobnego przeglądu", style = MaterialTheme.typography.titleMedium); plan.warnings.forEach { Text(it, color = Muted) } }
    }
}
@Composable private fun StatusDialog(row: RouteRow, locked: Boolean, dismiss: () -> Unit, confirm: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var acknowledged by remember { mutableStateOf(false) }
    val deleting = row.deletedAt == null
    AlertDialog(onDismissRequest = dismiss, title = { Text(if (deleting) "Soft delete trasy" else "Przywrócenie trasy") }, text = {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("#${row.id} · ${row.publicId}")
            Text(if (deleting) "Trasa zniknie z publicznego serwisu. Wersje, sugestie i pliki zostaną zachowane." else "Trasa i jej publiczne dane staną się ponownie dostępne w serwisie.")
            if (row.name.isNotEmpty()) { Text("Wpisz nazwę: ${row.name}"); OutlinedTextField(name, { name = it }, singleLine = true, label = { Text("Nazwa trasy") }) }
            Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(acknowledged, { acknowledged = it }); Text("Potwierdzam zmianę statusu tej trasy.") }
        }
    }, confirmButton = { Button(onClick = { confirm(name) }, enabled = !locked && name == row.name && acknowledged) { Text(if (deleting) "Potwierdź soft delete" else "Przywróć") } },
        dismissButton = { TextButton(onClick = dismiss) { Text("Anuluj") } })
}
