plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "fr.funkylldex.capture"
    compileSdk = 34

    defaultConfig {
        applicationId = "fr.funkylldex.capture"
        // 29 : `foregroundServiceType` n'existe pas avant Android 10, et c'est
        // lui qui autorise la capture depuis un service.
        minSdk = 29
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        // Pas de bloc `release` : cette application s'installe par adb, sur un
        // seul telephone. La cle de debogage est generee automatiquement et
        // vaut trente ans — le compte developpeur Play n'a aucune raison
        // d'entrer ici.
        getByName("debug") {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.0")
}
