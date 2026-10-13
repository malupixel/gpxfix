package com.tweakmyroute.admin.api

import java.net.URI

/** Validate before allocating a client or accepting credentials. No DNS-based HTTP exceptions. */
object Connection {
    fun normalize(raw: String): String {
        val uri = try { URI(raw.trim()) } catch (_: Exception) { error("Podaj poprawny adres API.") }
        require(uri.scheme in setOf("https", "http") && !uri.host.isNullOrBlank()) { "Podaj pełny adres API z https://." }
        require(uri.rawUserInfo == null && uri.rawQuery == null && uri.rawFragment == null) { "Adres API nie może zawierać poświadczeń, parametrów ani fragmentu." }
        require(uri.rawPath.isNullOrEmpty() || uri.rawPath == "/") { "Podaj adres serwera bez /api ani innej ścieżki." }
        // Literal loopback addresses only: localhost names/proxies must not become remote HTTP exceptions.
        require(uri.scheme == "https" || uri.host in setOf("127.0.0.1", "[::1]")) { "HTTP jest dozwolone wyłącznie dla 127.0.0.1 lub [::1]. Zdalny serwer wymaga HTTPS." }
        require(uri.port == -1 || uri.port in 1..65535) { "Niepoprawny port API." }
        return uri.toASCIIString().trimEnd('/')
    }
    fun validateSecret(secret: String) {
        require(secret.matches(Regex("[a-f0-9]{64}"))) { "Sekret powinien mieć 64 małe znaki szesnastkowe (openssl rand -hex 32)." }
    }
}
