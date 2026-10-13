package com.tweakmyroute.admin.preferences

import com.tweakmyroute.admin.api.Connection
import com.tweakmyroute.admin.api.ConnectionProfile
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.nio.file.*
import java.nio.file.attribute.PosixFilePermissions

interface ConnectionPreferences {
    fun load(profile: ConnectionProfile, baseUrl: String): String?
    fun save(profile: ConnectionProfile, baseUrl: String, secret: String)
    fun forget(profile: ConnectionProfile)
}

/** Explicitly requested local plaintext storage. Private directory (0700), atomic files (0600). */
class FileConnectionPreferences(private val directory: Path = defaultDirectory()) : ConnectionPreferences {
    @Serializable private class Credential(val baseUrl: String, val secret: String)
    private val json = Json { ignoreUnknownKeys = true }
    private val directoryPermissions = PosixFilePermissions.fromString("rwx------")
    private val filePermissions = PosixFilePermissions.fromString("rw-------")

    override fun load(profile: ConnectionProfile, baseUrl: String): String? {
        val normalized = profile.validateUrl(baseUrl)
        check(!Files.isSymbolicLink(directory)) { "Configuration directory must not be a symlink" }
        val file = path(profile)
        if (!Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) return null
        check(Files.size(file) <= 4096) { "Invalid credential file" }
        Files.setPosixFilePermissions(directory, directoryPermissions)
        Files.setPosixFilePermissions(file, filePermissions)
        val credential = json.decodeFromString<Credential>(Files.readString(file))
        // Never send an existing secret to a different server after an address override.
        if (credential.baseUrl != normalized) return null
        Connection.validateSecret(credential.secret)
        return credential.secret
    }

    override fun save(profile: ConnectionProfile, baseUrl: String, secret: String) {
        val normalized = profile.validateUrl(baseUrl)
        Connection.validateSecret(secret)
        check(!Files.isSymbolicLink(directory)) { "Configuration directory must not be a symlink" }
        Files.createDirectories(directory, PosixFilePermissions.asFileAttribute(directoryPermissions))
        Files.setPosixFilePermissions(directory, directoryPermissions)
        val temporary = Files.createTempFile(directory, ".credential-", ".tmp", PosixFilePermissions.asFileAttribute(filePermissions))
        try {
            Files.writeString(temporary, json.encodeToString(Credential(normalized, secret)))
            Files.move(temporary, path(profile), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } finally { Files.deleteIfExists(temporary) }
    }

    override fun forget(profile: ConnectionProfile) {
        check(!Files.isSymbolicLink(directory)) { "Configuration directory must not be a symlink" }
        Files.deleteIfExists(path(profile))
    }

    private fun path(profile: ConnectionProfile) = directory.resolve("${profile.name.lowercase()}.json")

    companion object {
        private fun defaultDirectory(): Path {
            val config = System.getenv("XDG_CONFIG_HOME")?.takeIf { it.isNotBlank() && Path.of(it).isAbsolute }
                ?.let(Path::of) ?: Path.of(System.getProperty("user.home"), ".config")
            return config.resolve("tweakmyroute-admin")
        }
    }
}
