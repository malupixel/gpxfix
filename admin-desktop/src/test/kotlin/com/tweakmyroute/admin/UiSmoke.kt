package com.tweakmyroute.admin

import androidx.compose.runtime.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.*
import com.tweakmyroute.admin.state.*
import com.tweakmyroute.admin.api.ConnectionProfile
import com.tweakmyroute.admin.preferences.FileConnectionPreferences
import com.tweakmyroute.admin.ui.AdminApp
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import java.awt.Robot
import java.io.File
import javax.imageio.ImageIO

/** Visual smoke displays only the real app and disposable localhost fixtures. No production access. */
fun main() = application {
    val store = remember { AdminStore(preferences = FileConnectionPreferences()) }
    Window(onCloseRequest = { store.close(); exitApplication() }, title = "TweakMyRoute Admin — local verification",
        state = rememberWindowState(width = 1440.dp, height = 920.dp)) {
        AdminApp(store)
        LaunchedEffect(Unit) {
            try {
                val output = File(System.getenv("TMR_ADMIN_SMOKE_SCREENSHOTS") ?: "/tmp/tmr-admin-screenshots").apply { mkdirs() }
                suspend fun capture(name: String) {
                    window.toFront()
                    delay(700)
                    // Capture only this application's window, never the full desktop.
                    val bounds = java.awt.Rectangle(window.locationOnScreen, window.size)
                    ImageIO.write(Robot().createScreenCapture(bounds), "png", File(output, "$name.png"))
                }
                check(ConnectionProfile.LOCAL.apiUrl() == "http://127.0.0.1:18151") { "UI smoke requires the disposable localhost profile override" }
                store.selectProfile(ConnectionProfile.LOCAL)
                capture("login")
                val secret = checkNotNull(System.getenv("TMR_ADMIN_SMOKE_SECRET"))
                store.connectSelected(secret)
                withTimeout(30_000) { store.state.first { it.authenticated || (!it.busy && it.error != null) } }
                check(store.state.value.authenticated) { "Local UI authentication failed" }
                capture("dashboard")
                store.navigate(Section.ROUTES)
                withTimeout(30_000) { store.state.first { !it.busy && it.routes != null } }
                capture("routes")
                val row = store.state.value.routes!!.items.first()
                store.openRoute(row.id)
                withTimeout(30_000) { store.state.first { !it.busy && it.details != null } }
                capture("details")
                store.tab(DetailTab.DELETE_PLAN)
                withTimeout(30_000) { store.state.first { !it.busy && it.deletePlan != null } }
                capture("dry-run")
                window.setSize(900, 720)
                store.navigate(Section.ROUTES)
                withTimeout(30_000) { store.state.first { !it.busy && it.routes != null } }
                capture("compact")
                store.disconnect()
                check(store.rememberedSecret(ConnectionProfile.LOCAL) == secret) { "Verified local secret was not remembered" }
                capture("remembered-login")
                println("UI smoke passed; screenshots: ${output.absolutePath}")
            } finally { store.close(); exitApplication() }
        }
    }
}
