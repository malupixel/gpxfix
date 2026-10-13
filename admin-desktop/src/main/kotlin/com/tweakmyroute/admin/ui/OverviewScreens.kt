package com.tweakmyroute.admin.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.tweakmyroute.admin.api.*
import com.tweakmyroute.admin.state.AdminState

@Composable fun DashboardScreen(dashboard: Dashboard?, openRoute: (Long) -> Unit) {
    if (dashboard == null) { Empty("Oczekiwanie na dane z API…"); return }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Heading("Przegląd serwisu", "Wszystkie trasy, również testowe i usunięte. Liczby pochodzą z bazy danych.")
        val stats = listOf("Wszystkie trasy" to dashboard.totalRoutes, "Aktywne" to dashboard.activeRoutes,
            "Soft delete" to dashboard.deletedRoutes, "Wersje tras" to dashboard.totalVersions,
            "Nowe · 7 dni" to dashboard.created7Days, "Nowe · 30 dni" to dashboard.created30Days,
            "Sugestie" to dashboard.totalSuggestions)
        stats.chunked(4).forEach { group ->
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.fillMaxWidth()) {
                group.forEach { (label, value) -> Panel(Modifier.weight(1f)) {
                    Text(label, color = Muted, style = MaterialTheme.typography.bodySmall)
                    Text(value.toString(), style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.SemiBold)
                } }
            }
        }
        Panel(Modifier.fillMaxWidth()) {
            Text("Sugestie według moderacji", fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                listOf("PENDING", "PUBLISHED", "REJECTED").forEach { status -> Badge("${Pl.label(status)}: ${dashboard.suggestionStatuses[status] ?: 0}") }
            }
        }
        Panel(Modifier.fillMaxWidth()) {
            Text("Ostatnio utworzone trasy", style = MaterialTheme.typography.titleMedium)
            if (dashboard.recentRoutes.isEmpty()) Empty("Nie utworzono jeszcze tras.")
            dashboard.recentRoutes.forEach { row ->
                Row(Modifier.fillMaxWidth().clickable { openRoute(row.id) }.padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) { Text(row.name.ifBlank { "Bez nazwy" }); Text("#${row.id} · ${row.publicId} · ${date(row.createdAt)}", color = Muted, style = MaterialTheme.typography.bodySmall) }
                    Text(km(row.distanceKm), color = Muted); Spacer(Modifier.width(16.dp))
                    Badge(if (row.deletedAt == null) "Aktywna" else "Usunięta", if (row.deletedAt == null) Accent else Danger)
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .3f))
            }
        }
        Panel(Modifier.fillMaxWidth()) {
            Text("Ostatnia aktywność", style = MaterialTheme.typography.titleMedium)
            ActivityItems(dashboard.recentActivity, openRoute)
        }
    }
}

@Composable fun ActivityItems(items: List<ActivityRow>, openRoute: ((Long) -> Unit)? = null) {
    if (items.isEmpty()) Empty("Brak zapisanej aktywności.")
    items.forEach { item ->
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(Pl.label(item.type))
                Text("${date(item.occurredAt)} · ${Pl.label(item.actorKind)}", color = Muted, style = MaterialTheme.typography.bodySmall)
            }
            if (openRoute != null) TextButton(onClick = { openRoute(item.routeId) }) { Text(item.routePublicId) }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .3f))
    }
}

@Composable fun SystemScreen(system: SystemStatus?) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Heading("System i diagnostyka", "Stan połączenia oraz podstawowe informacje udostępnione przez backend.")
        if (system == null) { Empty("Odśwież, aby pobrać diagnostykę."); return }
        Panel(Modifier.fillMaxWidth()) {
            KeyValue("API", system.apiStatus)
            KeyValue("Baza danych", if (system.databaseConnected) "Połączona" else "Niedostępna")
            KeyValue("Desktop", APP_VERSION)
            KeyValue("Backend", system.backendVersion)
            KeyValue("Rozmiar bazy", bytes(system.databaseBytes))
            KeyValue("Pliki GPX w referencjach", system.referencedGpxFiles.toString())
            KeyValue("Zadania podglądów", system.previewRecords.toString())
            KeyValue("Permanent delete", "Wyłączone")
        }
        Text("Storage: liczby dotyczą referencji w bazie, a nie pełnego skanu dysku. Obecność i rozmiar plików można sprawdzić w szczegółach trasy.", color = Muted)
    }
}

@Composable fun SettingsScreen(state: AdminState, disconnect: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Heading("Ustawienia połączenia")
        Panel(Modifier.fillMaxWidth()) {
            KeyValue("Adres API", state.baseUrl)
            KeyValue("Środowisko", state.profile.label)
            KeyValue("Uwierzytelnianie", "Sekret Bearer, zapamiętywany lokalnie")
            KeyValue("Język", "Polski")
            KeyValue("Motyw", "Ciemny")
            Text("Aby przełączyć środowisko lub zmienić sekret, rozłącz się i wybierz nowe połączenie. Zapamiętany klucz możesz usunąć na ekranie połączenia. Backend weryfikuje sekret przy każdym zapytaniu; jego rotacja wymaga ponownego połączenia.", color = Muted)
            Button(onClick = disconnect, enabled = !state.mutating) { Text("Zmień połączenie") }
        }
    }
}
