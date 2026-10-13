package com.tweakmyroute.admin.preferences

import com.tweakmyroute.admin.api.ConnectionProfile
import org.junit.jupiter.api.io.TempDir
import java.nio.file.*
import java.nio.file.attribute.PosixFilePermissions
import kotlin.test.*

class ConnectionPreferencesTest {
    @TempDir lateinit var temporary: Path
    private val productionSecret = "a1".repeat(32)
    private val localSecret = "b2".repeat(32)

    @Test fun remembersSecretsAcrossInstancesAndKeepsProfilesSeparate() {
        val directory = temporary.resolve("preferences")
        val first = FileConnectionPreferences(directory)
        first.save(ConnectionProfile.PRODUCTION, "https://tweakmyroute.com", productionSecret)
        first.save(ConnectionProfile.LOCAL, "http://127.0.0.1:8151", localSecret)
        val restarted = FileConnectionPreferences(directory)
        assertEquals(productionSecret, restarted.load(ConnectionProfile.PRODUCTION, "https://tweakmyroute.com"))
        assertEquals(localSecret, restarted.load(ConnectionProfile.LOCAL, "http://127.0.0.1:8151"))
        assertEquals(PosixFilePermissions.fromString("rwx------"), Files.getPosixFilePermissions(directory))
        for (file in listOf("production.json", "local.json")) {
            assertEquals(PosixFilePermissions.fromString("rw-------"), Files.getPosixFilePermissions(directory.resolve(file)))
        }
    }

    @Test fun changedServerAddressDoesNotReceiveRememberedSecret() {
        val preferences = FileConnectionPreferences(temporary.resolve("preferences"))
        preferences.save(ConnectionProfile.PRODUCTION, "https://tweakmyroute.com", productionSecret)
        preferences.save(ConnectionProfile.LOCAL, "http://127.0.0.1:8151", localSecret)
        assertNull(preferences.load(ConnectionProfile.PRODUCTION, "https://another.example"))
        assertNull(preferences.load(ConnectionProfile.LOCAL, "http://127.0.0.1:18151"))
        assertFailsWith<IllegalArgumentException> { ConnectionProfile.PRODUCTION.validateUrl("http://127.0.0.1:8151") }
        assertFailsWith<IllegalArgumentException> { ConnectionProfile.LOCAL.validateUrl("https://tweakmyroute.com") }
    }

    @Test fun forgettingOneProfilePreservesTheOther() {
        val preferences = FileConnectionPreferences(temporary.resolve("preferences"))
        preferences.save(ConnectionProfile.PRODUCTION, "https://tweakmyroute.com", productionSecret)
        preferences.save(ConnectionProfile.LOCAL, "http://127.0.0.1:8151", localSecret)
        preferences.forget(ConnectionProfile.PRODUCTION)
        assertNull(preferences.load(ConnectionProfile.PRODUCTION, "https://tweakmyroute.com"))
        assertEquals(localSecret, preferences.load(ConnectionProfile.LOCAL, "http://127.0.0.1:8151"))
    }

    @Test fun invalidSecretIsNeverWrittenAndSymlinkIsNeverRead() {
        val directory = temporary.resolve("preferences")
        val preferences = FileConnectionPreferences(directory)
        assertFailsWith<IllegalArgumentException> { preferences.save(ConnectionProfile.PRODUCTION, "https://tweakmyroute.com", "weak") }
        assertFalse(Files.exists(directory))
        Files.createDirectory(directory)
        val unrelated = temporary.resolve("unrelated.json")
        Files.writeString(unrelated, "private unrelated file")
        Files.createSymbolicLink(directory.resolve("production.json"), unrelated)
        assertNull(preferences.load(ConnectionProfile.PRODUCTION, "https://tweakmyroute.com"))
        preferences.save(ConnectionProfile.PRODUCTION, "https://tweakmyroute.com", productionSecret)
        assertEquals("private unrelated file", Files.readString(unrelated))
        assertFalse(Files.isSymbolicLink(directory.resolve("production.json")))
    }
}
