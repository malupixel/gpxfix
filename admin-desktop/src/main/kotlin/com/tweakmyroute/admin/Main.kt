package com.tweakmyroute.admin

import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.*
import com.tweakmyroute.admin.state.AdminStore
import com.tweakmyroute.admin.preferences.FileConnectionPreferences
import com.tweakmyroute.admin.ui.AdminApp
import java.awt.Dimension

fun main() = application {
    val store = remember { AdminStore(preferences = FileConnectionPreferences()) }
    DisposableEffect(store) { onDispose { store.close() } }
    Window(
        title = "TweakMyRoute Admin",
        state = rememberWindowState(width = 1440.dp, height = 920.dp),
        onCloseRequest = { store.close(); exitApplication() },
    ) {
        LaunchedEffect(Unit) { window.minimumSize = Dimension(800, 620) }
        AdminApp(store)
    }
}
