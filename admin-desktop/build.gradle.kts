import org.jetbrains.compose.desktop.application.dsl.TargetFormat

plugins {
    kotlin("jvm") version "2.4.21"
    kotlin("plugin.serialization") version "2.4.21"
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.21"
    id("org.jetbrains.compose") version "1.12.1"
}

group = "com.tweakmyroute"
version = "0.1.1"
kotlin { jvmToolchain(21) }

dependencies {
    implementation(compose.desktop.currentOs)
    // Latest stable Material 3; Compose's default currently points to an alpha.
    implementation("org.jetbrains.compose.material3:material3:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-swing:1.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")
    implementation("io.ktor:ktor-client-cio:3.6.0")
    implementation("io.ktor:ktor-client-content-negotiation:3.6.0")
    implementation("io.ktor:ktor-serialization-kotlinx-json:3.6.0")
    testImplementation(kotlin("test-junit5"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.13.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    testImplementation("io.ktor:ktor-client-mock:3.6.0")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.11.0")
}

tasks.test { useJUnitPlatform() }

// Optional end-to-end smoke against a disposable localhost backend; never production.
tasks.register<JavaExec>("apiSmoke") {
    dependsOn(tasks.testClasses)
    classpath = sourceSets.test.get().runtimeClasspath
    mainClass.set("com.tweakmyroute.admin.ApiSmokeKt")
}
tasks.register<JavaExec>("uiSmoke") {
    dependsOn(tasks.testClasses)
    classpath = sourceSets.test.get().runtimeClasspath
    mainClass.set("com.tweakmyroute.admin.UiSmokeKt")
}
compose.desktop {
    application {
        mainClass = "com.tweakmyroute.admin.MainKt"
        nativeDistributions {
            targetFormats(TargetFormat.Deb)
            packageName = "tweakmyroute-admin"
            packageVersion = "0.1.1"
            description = "TweakMyRoute Admin — zarządzanie trasami"
            vendor = "TweakMyRoute"
            modules("java.net.http", "java.sql", "jdk.unsupported")
            linux {
                menuGroup = "Utility"
                appCategory = "Utility"
                shortcut = true
                debMaintainer = "TweakMyRoute"
            }
        }
    }
}
