package com.tweakmyroute.admin.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import com.tweakmyroute.admin.api.Page
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

val Accent = Color(0xFF66E3C4)
val Surface = Color(0xFF17212C)
val Muted = Color(0xFF9AABB9)
val Danger = Color(0xFFFF9B9B)
const val APP_VERSION = "0.1.1"

object Pl {
    fun section(section: com.tweakmyroute.admin.state.Section) = when (section) {
        com.tweakmyroute.admin.state.Section.DASHBOARD -> "Dashboard"
        com.tweakmyroute.admin.state.Section.ROUTES -> "Trasy"
        com.tweakmyroute.admin.state.Section.SUGGESTIONS -> "Sugestie"
        com.tweakmyroute.admin.state.Section.SYSTEM -> "System"
        com.tweakmyroute.admin.state.Section.SETTINGS -> "Ustawienia"
    }
    fun label(code: String): String = when (code) {
        "PRODUCTION" -> "Produkcja"; "LOCAL" -> "Local"
        "ALL" -> "Wszystkie"; "ACTIVE" -> "Aktywne"; "DELETED" -> "Usunięte"
        "PENDING" -> "Oczekujące"; "PUBLISHED" -> "Opublikowane"; "REJECTED" -> "Odrzucone"
        "NOTE" -> "Notatka"; "PROBLEM" -> "Problem"; "DETOUR" -> "Objazd"
        "SHORT" -> "Poniżej 1 km"; "UNNAMED" -> "Bez nazwy"; "TEST_NAME" -> "Nazwa: test / debug / tmp"
        "OLD_WITHOUT_SUGGESTIONS" -> "Ponad 180 dni, bez sugestii"; "INCOMPLETE" -> "Niekompletne / zerowa długość"
        "METADATA" -> "Informacje"; "VERSIONS" -> "Wersje"; "SUGGESTIONS" -> "Sugestie"
        "ACTIVITY" -> "Aktywność"; "FILES" -> "Pliki"; "DELETE_PLAN" -> "Trwałe usuwanie · dry-run"
        "INITIAL_UPLOAD" -> "Import GPX"; "INITIAL_DRAWN" -> "Narysowana trasa"; "OWNER_EDIT" -> "Edycja właściciela"
        "SUGGESTION_MERGE" -> "Scalenie sugestii"; "ROUTE_CREATED" -> "Utworzono trasę"
        "ROUTE_DELETED" -> "Usunięto trasę (soft delete)"; "ROUTE_RESTORED" -> "Przywrócono trasę"
        "VERSION_CREATED" -> "Utworzono wersję"; "OWNER_EDITED" -> "Właściciel zmienił trasę"
        "METADATA_UPDATED" -> "Zmieniono opis trasy"; "SUGGESTIONS_OPENED" -> "Otwarto sugestie"; "SUGGESTIONS_CLOSED" -> "Zamknięto sugestie"
        "SUGGESTION_CREATED" -> "Dodano sugestię"; "SUGGESTION_PUBLISHED" -> "Opublikowano sugestię"
        "SUGGESTION_UNPUBLISHED" -> "Wycofano publikację sugestii"; "SUGGESTION_REJECTED" -> "Odrzucono sugestię"
        "SUGGESTION_MERGED" -> "Scalono sugestię"; "COMMENT_CREATED" -> "Dodano komentarz"
        "COMMENT_PUBLISHED" -> "Opublikowano komentarz"; "COMMENT_REJECTED" -> "Odrzucono komentarz"
        "NOT_APPLICABLE" -> "Nie dotyczy"; "NOT_MERGED" -> "Niescalona"; "MERGED" -> "Scalona"
        "CLEAN" -> "Zgodna"; "CONFLICT" -> "Konflikt"; "OUTDATED" -> "Nieaktualna"
        "ADMIN" -> "Administrator"; "OWNER" -> "Właściciel"; "CONTRIBUTOR" -> "Autor"
        "createdAt" -> "Utworzenie"; "updatedAt" -> "Aktualizacja"; "name" -> "Nazwa"; "distanceKm" -> "Długość"
        "publicId" -> "Public ID"; "id" -> "ID"; "ASC" -> "Rosnąco"; "DESC" -> "Malejąco"
        else -> code
    }
}

fun date(value: String?): String = value?.let {
    runCatching { DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm").withZone(ZoneId.systemDefault()).format(Instant.parse(it)) }.getOrDefault(it)
} ?: "—"
fun km(value: Double) = String.format(Locale.forLanguageTag("pl-PL"), "%.2f km", value)
fun bytes(value: Long?) = value?.let { String.format(Locale.forLanguageTag("pl-PL"), "%.2f MB", it / 1_048_576.0) } ?: "—"

@Composable fun Panel(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier, shape = MaterialTheme.shapes.large, color = Surface) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
    }
}
@Composable fun Heading(title: String, subtitle: String? = null) {
    Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
    subtitle?.let { Text(it, color = Muted, style = MaterialTheme.typography.bodyMedium) }
}
@Composable fun Badge(text: String, color: Color = Accent) {
    Text(text, Modifier.clip(MaterialTheme.shapes.small).background(color.copy(alpha = .10f)).padding(horizontal = 10.dp, vertical = 5.dp),
        color = color, style = MaterialTheme.typography.labelMedium)
}
@Composable fun Message(text: String, error: Boolean = false) {
    val color = if (error) Danger else Accent
    Surface(color = color.copy(alpha = .10f), shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
        Text(text, Modifier.padding(14.dp), color = color)
    }
}
@Composable fun Empty(text: String = "Brak danych dla wybranych filtrów.") {
    Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { Text(text, color = Muted) }
}
@Composable fun Choice(label: String, value: String, choices: List<String>, modifier: Modifier = Modifier, enabled: Boolean = true, onChange: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Column(modifier) {
        Text(label, color = Muted, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(bottom = 5.dp))
        Box {
            OutlinedButton(onClick = { expanded = true }, enabled = enabled, modifier = Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.small) {
                Text(Pl.label(value), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f)); Text("⌄")
            }
            DropdownMenu(expanded = expanded && enabled, onDismissRequest = { expanded = false }) {
                choices.forEach { option -> DropdownMenuItem(text = { Text(Pl.label(option)) }, onClick = { expanded = false; onChange(option) }) }
            }
        }
    }
}
@Composable fun <T> Pager(page: Page<T>?, busy: Boolean, onPage: (Int) -> Unit) {
    if (page == null) return
    Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("${page.total} wyników · strona ${page.page + 1}", color = Muted, modifier = Modifier.weight(1f))
        TextButton(onClick = { onPage(page.page - 1) }, enabled = !busy && page.page > 0) { Text("← Poprzednia") }
        TextButton(onClick = { onPage(page.page + 1) }, enabled = !busy && page.hasNext) { Text("Następna →") }
    }
}
@Composable fun KeyValue(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
        Text(label, color = Muted, modifier = Modifier.width(190.dp)); Text(value, modifier = Modifier.weight(1f))
    }
}
