plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.trace.guard"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.trace.guard"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        // signed with the local debug key, so the APK installs straight away
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
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
    // Deliberately none: plain framework Views and the Kotlin stdlib only, so the build is fast
    // and there is nothing to resolve at 2 a.m. on venue wifi.
}
