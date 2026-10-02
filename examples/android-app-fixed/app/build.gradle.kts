plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.example.orders"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.orders"
        minSdk = 24
        targetSdk = 34
    }

    flavorDimensions += "tier"
    productFlavors {
        create("free") { dimension = "tier" }
        create("paid") { dimension = "tier" }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    // Usage numbers for the product team.
    implementation(libs.firebase.analytics)

    testImplementation("junit:junit:4.13.2")
}
