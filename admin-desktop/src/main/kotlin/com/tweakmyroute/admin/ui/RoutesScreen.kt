package com.tweakmyroute.admin.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import com.tweakmyroute.admin.api.*
import com.tweakmyroute.admin.state.*

@Composable fun RoutesScreen(state: AdminState, store: AdminStore) {
    var filter by remember(state.routeFilter) { mutableStateOf(state.routeFilter) }
    var confirmBulk by remember { mutableStateOf(false) }
    val locked = state.busy || state.mutating
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Panel(Modifier.fillMaxWidth()) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Bottom) {
                OutlinedTextField(filter.search, { filter = filter.copy(search = it) }, label = { Text("Nazwa, ID lub Public ID") }, singleLine = true, modifier = Modifier.weight(1f))
                Choice("Status", filter.status, listOf("ALL", "ACTIVE", "DELETED"), Modifier.width(150.dp)) { filter = filter.copy(status = it) }
                Choice("Kandydaci do przeglądu", filter.candidate, listOf("ALL", "SHORT", "UNNAMED", "TEST_NAME", "OLD_WITHOUT_SUGGESTIONS", "INCOMPLETE"), Modifier.width(230.dp)) { filter = filter.copy(candidate = it) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Bottom) {
                OutlinedTextField(filter.from, { filter = filter.copy(from = it) }, label = { Text("Od · RRRR-MM-DD") }, singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(filter.to, { filter = filter.copy(to = it) }, label = { Text("Do · RRRR-MM-DD") }, singleLine = true, modifier = Modifier.weight(1f))
                Choice("Sortowanie", filter.sort, listOf("createdAt", "updatedAt", "name", "id", "publicId", "distanceKm"), Modifier.width(150.dp)) { filter = filter.copy(sort = it) }
                Choice("Kierunek", filter.direction, listOf("DESC", "ASC"), Modifier.width(135.dp)) { filter = filter.copy(direction = it) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Button(onClick = { store.filterRoutes(filter) }, enabled = !locked) { Text("Zastosuj filtry") }
                TextButton(onClick = { filter = RouteFilter(); store.filterRoutes(filter) }, enabled = !locked) { Text("Wyczyść") }
                Text("Daty utworzenia w UTC. Kandydaci wymagają ręcznego przeglądu.", color = Muted, style = MaterialTheme.typography.bodySmall)
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Zaznaczono: ${state.selected.size}", color = Muted, modifier = Modifier.weight(1f))
            if (state.selected.isNotEmpty()) {
                TextButton(onClick = store::clearSelection, enabled = !locked) { Text("Odznacz") }
                OutlinedButton(onClick = { confirmBulk = true }, enabled = !locked) { Text("Soft delete zaznaczonych", color = Danger) }
            }
        }
        RouteTable(state.routes?.items.orEmpty(), state.selected, locked, store::toggle, store::openRoute, Modifier.weight(1f))
        Pager(state.routes, locked) { store.filterRoutes(state.routeFilter, it) }
    }
    if (confirmBulk) {
        val rows = state.routes?.items.orEmpty().filter { it.id in state.selected }
        BulkDialog(rows, locked, onDismiss = { confirmBulk = false }) {
            confirmBulk = false; store.bulkDelete(rows.map(RouteRow::id))
        }
    }
}

private val widths = listOf(44.dp, 60.dp, 116.dp, 204.dp, 136.dp, 136.dp, 100.dp, 64.dp, 72.dp, 104.dp, 100.dp)
@Composable private fun RouteTable(items: List<RouteRow>, selected: Set<Long>, locked: Boolean,
    toggle: (RouteRow) -> Unit, open: (Long) -> Unit, modifier: Modifier) {
    val scroll = rememberScrollState()
    Surface(modifier.fillMaxWidth(), color = Surface, shape = MaterialTheme.shapes.large) {
        Column {
            Box(Modifier.weight(1f).horizontalScroll(scroll)) {
                Column(Modifier.width(widths.fold(0.dp) { sum, width -> sum + width }).fillMaxHeight()) {
                    Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant).padding(vertical = 14.dp)) {
                        listOf("", "ID", "Public ID", "Nazwa", "Utworzenie", "Aktualizacja", "Długość", "Wersje", "Sugestie", "Status", "").forEachIndexed { i, label -> Cell(label, widths[i], true) }
                    }
                    if (items.isEmpty()) Empty()
                    LazyColumn(Modifier.weight(1f)) {
                        items(items, key = RouteRow::id) { row ->
                            Row(Modifier.fillMaxWidth().heightIn(min = 66.dp).background(if (row.id in selected) Accent.copy(alpha = .06f) else Surface)
                                .clickable(enabled = !locked) { open(row.id) }, verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.width(widths[0]), contentAlignment = Alignment.Center) { Checkbox(row.id in selected, { toggle(row) }, enabled = !locked && row.deletedAt == null) }
                                Cell(row.id.toString(), widths[1]); Cell(row.publicId, widths[2]); Cell(row.name.ifBlank { "Bez nazwy" }, widths[3])
                                Cell(date(row.createdAt), widths[4]); Cell(date(row.updatedAt), widths[5]); Cell(km(row.distanceKm), widths[6])
                                Cell(row.versionCount.toString(), widths[7]); Cell(row.suggestionCount.toString(), widths[8])
                                Box(Modifier.width(widths[9])) { Badge(if (row.deletedAt == null) "Aktywna" else "Usunięta", if (row.deletedAt == null) Accent else Danger) }
                                TextButton(onClick = { open(row.id) }, enabled = !locked, modifier = Modifier.width(widths[10])) { Text("Szczegóły") }
                            }
                            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .25f))
                        }
                    }
                }
            }
            HorizontalScrollbar(rememberScrollbarAdapter(scroll), Modifier.fillMaxWidth().padding(6.dp))
        }
    }
}
@Composable private fun Cell(text: String, width: Dp, header: Boolean = false) {
    Text(text, Modifier.width(width).padding(horizontal = 10.dp), color = if (header) Muted else MaterialTheme.colorScheme.onSurface,
        style = if (header) MaterialTheme.typography.labelMedium else MaterialTheme.typography.bodySmall,
        fontWeight = if (header) FontWeight.SemiBold else FontWeight.Normal, maxLines = 2, overflow = TextOverflow.Ellipsis)
}

@Composable private fun BulkDialog(rows: List<RouteRow>, locked: Boolean, onDismiss: () -> Unit, onConfirm: () -> Unit) {
    var confirmation by remember { mutableStateOf("") }
    val expected = "USUŃ ${rows.size} TRAS"
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Zbiorczy soft delete") }, text = {
        Column(Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("${rows.size} tras zniknie z publicznego serwisu. Wersje, sugestie i pliki zostaną zachowane. Operację można cofnąć przez przywrócenie tras.")
            rows.forEach { Text("#${it.id} · ${it.publicId} · ${it.name.ifBlank { "Bez nazwy" }}", style = MaterialTheme.typography.bodySmall) }
            Text("Backend ponownie sprawdzi status każdej trasy. Zmiana statusu jednej z nich anuluje całą operację.", color = Muted)
            OutlinedTextField(confirmation, { confirmation = it }, label = { Text("Wpisz: $expected") }, singleLine = true)
        }
    }, confirmButton = { Button(onClick = onConfirm, enabled = !locked && rows.isNotEmpty() && confirmation == expected) { Text("Potwierdź soft delete") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Anuluj") } })
}
