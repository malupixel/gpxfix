package com.tweakmyroute.admin.api

import java.net.URI

enum class ConnectionProfile(val label: String, val defaultApiUrl: String, val defaultPublicUrl: String) {
    PRODUCTION("Produkcja", "https://tweakmyroute.com", "https://tweakmyroute.com"),
    LOCAL("Local", "http://127.0.0.1:8151", "http://127.0.0.1:8150");

    fun apiUrl(): String {
        val override = System.getenv("TMR_ADMIN_${name}_API_URL")
        val legacy = System.getenv("TMR_ADMIN_API_URL")?.takeIf { isLoopback(it) == (this == LOCAL) }
        return override ?: legacy ?: defaultApiUrl
    }

    fun validateUrl(raw: String): String = Connection.normalize(raw).also { normalized ->
        if (this == LOCAL) require(isLoopback(normalized)) { "Profil Local wymaga adresu loopback." }
        else require(URI(normalized).scheme == "https") { "Produkcja wymaga HTTPS." }
    }

    companion object {
        fun initial(): ConnectionProfile = if (System.getenv("TMR_ADMIN_API_URL")?.let(::isLoopback) == true) LOCAL else PRODUCTION
        private fun isLoopback(raw: String): Boolean = runCatching { URI(raw).host in setOf("127.0.0.1", "[::1]") }.getOrDefault(false)
    }
}
