package com.tweakmyroute.admin.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.tweakmyroute.admin.api.*
import com.tweakmyroute.admin.state.*

@Composable fun SuggestionsScreen(state: AdminState, store: AdminStore) {
    var status by remember(state.suggestionStatus) { mutableStateOf(state.suggestionStatus) }
    var search by remember(state.suggestionSearch) { mutableStateOf(state.suggestionSearch) }
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Panel(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(search, { search = it }, label = { Text("Powiązana trasa · nazwa, ID, Public ID") }, singleLine = true, modifier = Modifier.weight(1f))
                Choice("Moderacja", status, listOf("ALL", "PENDING", "PUBLISHED", "REJECTED"), Modifier.width(190.dp)) { status = it }
                Button(onClick = { store.filterSuggestions(status, search) }, enabled = !state.busy && !state.mutating) { Text("Filtruj") }
            }
            Text("Widok tylko do odczytu. Publikowanie i scalanie pozostają w istniejącym procesie właściciela trasy.", color = Muted, style = MaterialTheme.typography.bodySmall)
        }
        SuggestionList(state.suggestions, store::openRoute, Modifier.weight(1f))
        Pager(state.suggestions, state.busy) { store.filterSuggestions(state.suggestionStatus, state.suggestionSearch, it) }
    }
}

@Composable fun SuggestionList(page: Page<SuggestionRow>?, openRoute: (Long) -> Unit, modifier: Modifier = Modifier) {
    if (page == null) { Empty("Oczekiwanie na sugestie…"); return }
    if (page.items.isEmpty()) { Empty("Brak sugestii dla wybranych filtrów."); return }
    LazyColumn(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items(page.items, key = SuggestionRow::id) { row ->
            var expanded by remember(row.id) { mutableStateOf(false) }
            Panel(Modifier.fillMaxWidth().clickable { expanded = !expanded }) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Badge(Pl.label(row.type))
                    Badge(Pl.label(row.moderationStatus), if (row.moderationStatus == "REJECTED") Danger else Muted)
                    Text("#${row.id} · ${row.publicId}", color = Muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
                    Text(date(row.createdAt), color = Muted, style = MaterialTheme.typography.bodySmall)
                }
                Text(row.description, maxLines = if (expanded) Int.MAX_VALUE else 3, overflow = TextOverflow.Ellipsis)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${Pl.label(row.integrationStatus)} · ${Pl.label(row.applicability)}", color = Muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
                    TextButton(onClick = { openRoute(row.routeId) }) { Text("${row.routeName.ifBlank { "Bez nazwy" }} →", maxLines = 1) }
                }
                if (!expanded && row.description.length > 200) Text("Kliknij, aby rozwinąć treść", color = Muted, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}
