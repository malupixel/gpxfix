package com.tweakmyroute.admin.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.tweakmyroute.admin.state.*
import com.tweakmyroute.admin.api.ConnectionProfile
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable fun AdminApp(store: AdminStore) {
    val state by store.state.collectAsState()
    MaterialTheme(colorScheme = darkColorScheme(
        primary = Accent, onPrimary = Color(0xFF082A23), background = Color(0xFF0E161F),
        surface = Surface, onSurface = Color(0xFFEDF4F8), surfaceVariant = Color(0xFF23303D),
        onSurfaceVariant = Muted, outline = Color(0xFF3D4C59), error = Danger,
    )) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            if (!state.authenticated) Login(state, store) else Workspace(state, store)
        }
    }
}

@Composable private fun Login(state: AdminState, store: AdminStore) {
    var secret by remember(state.profile) { mutableStateOf("") }
    var remembered by remember(state.profile) { mutableStateOf(false) }
    var loadingSecret by remember(state.profile) { mutableStateOf(true) }
    var preferenceError by remember(state.profile) { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(state.profile) {
        try {
            val saved = store.rememberedSecret(state.profile)
            secret = saved.orEmpty()
            remembered = saved != null
        } catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { preferenceError = "Nie udało się wczytać zapamiętanego sekretu. Wpisz go ponownie." }
        finally { loadingSecret = false }
    }
    Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
        Panel(Modifier.widthIn(max = 520.dp).fillMaxWidth()) {
            Badge("TWEAKMYROUTE / ADMIN")
            Heading("Twoje trasy. Pełny obraz.", "Połącz się z backendem i bezpiecznie zarządzaj serwisem.")
            Spacer(Modifier.height(8.dp))
            Choice("Środowisko", state.profile.name, ConnectionProfile.entries.map { it.name }, Modifier.fillMaxWidth(), enabled = !state.busy && !loadingSecret) {
                store.selectProfile(ConnectionProfile.valueOf(it))
            }
            Text(state.baseUrl, color = Muted, style = MaterialTheme.typography.bodySmall)
            OutlinedTextField(secret, { secret = it }, label = { Text("Sekret administratora") }, singleLine = true,
                visualTransformation = PasswordVisualTransformation(), enabled = !state.busy && !loadingSecret, modifier = Modifier.fillMaxWidth())
            Text(if (remembered) "Sekret dla tego środowiska został zapamiętany na tym komputerze." else "Po poprawnym połączeniu sekret zostanie zapamiętany na tym komputerze.", color = Muted, style = MaterialTheme.typography.bodySmall)
            if (remembered) TextButton(enabled = !state.busy && !loadingSecret, onClick = {
                loadingSecret = true
                scope.launch {
                    try { store.forgetSecret(state.profile); secret = ""; remembered = false; preferenceError = null }
                    catch (cancelled: CancellationException) { throw cancelled }
                    catch (_: Exception) { preferenceError = "Nie udało się usunąć zapamiętanego sekretu." }
                    finally { loadingSecret = false }
                }
            }) { Text("Zapomnij zapisany klucz") }
            preferenceError?.let { Message(it, true) }
            state.error?.let { Message(it, true) }
            if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            Button(onClick = { store.connectSelected(secret) }, enabled = !state.busy && !loadingSecret && secret.isNotBlank(), modifier = Modifier.fillMaxWidth().height(48.dp)) {
                Text(if (state.busy) "Łączenie…" else "Połącz z serwisem")
            }
            Text("v$APP_VERSION · Ubuntu / Desktop", color = Muted, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable private fun Workspace(state: AdminState, store: AdminStore) {
    BoxWithConstraints {
        val compact = maxWidth < 1100.dp
        Row(Modifier.fillMaxSize()) {
            Column(Modifier.width(if (compact) 88.dp else 224.dp).fillMaxHeight().background(Color(0xFF121D27)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (compact) "TMR" else "TweakMyRoute", color = Accent, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(vertical = 18.dp))
                if (!compact) Text("PANEL ADMINISTRATORA", color = Muted, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(bottom = 20.dp))
                Section.entries.forEach { section ->
                    val active = state.section == section
                    Row(Modifier.fillMaxWidth().clip(MaterialTheme.shapes.medium)
                        .background(if (active) Accent.copy(alpha = .12f) else Color.Transparent)
                        .clickable(enabled = !state.mutating) { store.navigate(section) }.padding(vertical = 14.dp, horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        NavIcon(section, if (active) Accent else Muted)
                        if (!compact) Text(Pl.section(section), color = if (active) Accent else Muted, fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal)
                    }
                }
                Spacer(Modifier.weight(1f))
                if (!compact) Text("Jedno bezpieczne połączenie.\nDane prosto z backendu.", color = Muted, style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = store::disconnect, enabled = !state.mutating, contentPadding = PaddingValues(0.dp), modifier = Modifier.fillMaxWidth()) {
                    Text(if (compact) "Wyjdź" else "Rozłącz", color = Muted, maxLines = 1)
                }
            }
            Column(Modifier.weight(1f).fillMaxHeight().padding(if (compact) 20.dp else 32.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(if (state.details != null) "Szczegóły trasy" else Pl.section(state.section), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
                        Text(state.baseUrl, color = Muted, style = MaterialTheme.typography.bodySmall)
                    }
                    Badge(if (state.apiOnline) "● API połączone" else "● API niedostępne", if (state.apiOnline) Accent else Danger)
                    Spacer(Modifier.width(12.dp))
                    OutlinedButton(onClick = { store.refresh() }, enabled = !state.busy && !state.mutating) { Text("Odśwież") }
                }
                if (state.busy || state.mutating) LinearProgressIndicator(Modifier.fillMaxWidth())
                state.error?.let { Message(it, true) }
                state.notice?.let { Message(it) }
                Box(Modifier.weight(1f)) {
                    if (state.details != null) RouteDetailsScreen(state, store)
                    else when (state.section) {
                        Section.DASHBOARD -> DashboardScreen(state.dashboard, store::openRoute)
                        Section.ROUTES -> RoutesScreen(state, store)
                        Section.SUGGESTIONS -> SuggestionsScreen(state, store)
                        Section.SYSTEM -> SystemScreen(state.system)
                        Section.SETTINGS -> SettingsScreen(state, store::disconnect)
                    }
                }
            }
        }
    }
}

/** Five small code-native navigation icons share one stroke/spacing system. */
@Composable private fun NavIcon(section: Section, color: Color) {
    Canvas(Modifier.size(22.dp)) {
        val unit = size.width / 24f
        fun line(x1: Float, y1: Float, x2: Float, y2: Float) = drawLine(color, androidx.compose.ui.geometry.Offset(x1 * unit, y1 * unit), androidx.compose.ui.geometry.Offset(x2 * unit, y2 * unit), 1.7f * unit)
        fun box(x: Float, y: Float, w: Float, h: Float) = drawRect(color, androidx.compose.ui.geometry.Offset(x * unit, y * unit), androidx.compose.ui.geometry.Size(w * unit, h * unit), style = androidx.compose.ui.graphics.drawscope.Stroke(1.7f * unit))
        when (section) {
            Section.DASHBOARD -> { box(3f,3f,7f,7f); box(14f,3f,7f,7f); box(3f,14f,7f,7f); box(14f,14f,7f,7f) }
            Section.ROUTES -> { line(4f,19f,10f,6f); line(10f,6f,16f,17f); line(16f,17f,21f,4f); drawCircle(color,2f*unit,androidx.compose.ui.geometry.Offset(4f*unit,19f*unit)); drawCircle(color,2f*unit,androidx.compose.ui.geometry.Offset(21f*unit,4f*unit)) }
            Section.SUGGESTIONS -> { box(3f,4f,18f,13f); line(6f,17f,6f,21f); line(6f,21f,11f,17f); line(7f,9f,17f,9f); line(7f,13f,14f,13f) }
            Section.SYSTEM -> { line(2f,13f,7f,13f); line(7f,13f,10f,4f); line(10f,4f,14f,20f); line(14f,20f,18f,11f); line(18f,11f,22f,11f) }
            Section.SETTINGS -> { for (y in listOf(6f,12f,18f)) line(3f,y,21f,y); box(6f,4f,3f,4f); box(15f,10f,3f,4f); box(9f,16f,3f,4f) }
        }
    }
}
