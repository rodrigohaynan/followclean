plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "br.com.followclean.app"

    val signingFilePath = System.getenv("FOLLOWCLEAN_SIGNING_FILE")
    val signingPassword = System.getenv("FOLLOWCLEAN_SIGNING_PASSWORD")
    val followCleanSigning =
        if (!signingFilePath.isNullOrBlank() && !signingPassword.isNullOrBlank()) {
            signingConfigs.create("followcleanRelease") {
                storeFile = file(signingFilePath)
                storePassword = signingPassword
                keyAlias = "followclean"
                keyPassword = signingPassword
            }
        } else {
            null
        }
    compileSdk = 35

    defaultConfig {
        applicationId = "br.com.followclean.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 27
        versionName = "0.3.21"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (followCleanSigning != null) {
                signingConfig = followCleanSigning
            }
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
    implementation("androidx.webkit:webkit:1.12.1")
}
