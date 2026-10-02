# Permissions and SDKs

The two tables the tool compares with the answers file. Both are indicative: they say which data type a permission or an SDK can point at, not that the app collects it. Google's page says so itself: an app that holds a permission but does not collect or share the data does not declare it. The tables are in [src/data.js](../src/data.js), and `test/data.test.js` compares them with the saved text of every page named here.

## Sources

| Page | Saved as |
| --- | --- |
| https://support.google.com/googleplay/android-developer/answer/10787469 (Data safety: data types, purposes, what counts as collection and sharing) | [data-safety-section.txt](../research/sources/data-safety-section.txt) |
| https://developer.android.com/reference/android/Manifest.permission (permission names and what each allows) | [manifest-permission.txt](../research/sources/manifest-permission.txt) |
| https://support.google.com/analytics/answer/11582702 (Google Analytics for Firebase SDK) | [sdk-google-analytics-for-firebase.txt](../research/sources/sdk-google-analytics-for-firebase.txt) |
| https://firebase.google.com/docs/android/play-data-disclosure (Firebase Android SDKs: Crashlytics, Authentication and the Google Analytics entry) | [sdk-firebase-play-data-disclosure.txt](../research/sources/sdk-firebase-play-data-disclosure.txt) |
| https://developers.google.com/admob/android/privacy/play-data-disclosure (Google Mobile Ads SDK) | [sdk-google-mobile-ads.txt](../research/sources/sdk-google-mobile-ads.txt) |
| https://developers.google.com/maps/documentation/android-sdk/play-data-disclosure (Maps SDK for Android) | [sdk-maps-sdk-for-android.txt](../research/sources/sdk-maps-sdk-for-android.txt) |

The address is the first line of each saved file. The Gradle coordinates of the Maps SDK and the Mobile Ads SDK are named on https://developers.google.com/android/guides/setup (the line is quoted in their saved files); those of the Firebase SDKs are written on the Firebase page.

## Permissions

A manifest permission is looked up by its full name, letter case included: `android.permission.CAMERA`, not `CAMERA` or `android.permission.camera`. The "Android" column is a phrase of the Android reference text of the permission, and the "Google" column a phrase of Google's description of the data type; a test finds both in the saved pages.

Level `direct`: the Android text says the permission reads that data, and Google's page defines the data type as that data, or names the permission. Not declaring the data type is a warning (`permission-undeclared`), and declaring it as neither collected nor shared is a warning (`declared-not-collected`). Level `review`: the permission is a capability that may or may not produce data of that type, or can map to more than one type. Not declaring any of the data types is a review finding (`permission-review`), never more; declaring one of them, collected or not, answers it. Where two data types are listed, any one of them is enough.

| Permission | Data type | Level | Android and Google |
| --- | --- | --- | --- |
| `ACCESS_FINE_LOCATION` | `Precise location` | direct | Android: "access precise location". Google: "ACCESS_FINE_LOCATION permission" |
| `ACCESS_COARSE_LOCATION` | `Approximate location` | direct | Android: "access approximate location". Google: "ACCESS_COARSE_LOCATION permission" |
| `READ_CONTACTS` | `Contacts` | direct | Android: "read the user's contacts data". Google: "contacts such as contact names" |
| `READ_CALL_LOG` | `Contacts` | direct | Android: "read the user's call log". Google: "call history" |
| `READ_CALENDAR` | `Calendar events` | direct | Android: "read the user's calendar data". Google: "calendar such as events" |
| `READ_SMS` | `SMS or MMS` | direct | Android: "read SMS messages". Google: "text messages" |
| `RECEIVE_SMS` | `SMS or MMS` | direct | Android: "receive SMS messages". Google: "text messages" |
| `READ_PHONE_NUMBERS` | `Phone number` | review | Android: "phone number(s)". Google: "phone number" |
| `CAMERA` | `Photos` or `Videos` | review | Android: "access the camera device". Google: "photos" |
| `RECORD_AUDIO` | `Voice or sound recordings` | review | Android: "record audio". Google: "sound recording" |
| `BODY_SENSORS` | `Health info` or `Fitness info` | review | Android: "heart rate". Google: "medical records or symptoms" |
| `BODY_SENSORS_BACKGROUND` | `Health info` or `Fitness info` | review | Android: "heart rate". Google: "medical records or symptoms" |
| `ACTIVITY_RECOGNITION` | `Fitness info` | review | Android: "recognize physical activity". Google: "exercise or other physical activity" |
| `GET_ACCOUNTS` | `User IDs` or `Email address` | review | Android: "list of accounts". Google: "account name" |
| `READ_MEDIA_IMAGES` | `Photos` | review | Android: "read image files". Google: "photos" |
| `READ_MEDIA_VIDEO` | `Videos` | review | Android: "read video files". Google: "videos" |
| `READ_MEDIA_AUDIO` | `Music files` or `Other audio files` | review | Android: "read audio files". Google: "music files" |
| `READ_EXTERNAL_STORAGE` | `Files and docs` | review | Android: "read from external storage". Google: "files or documents" |
| `QUERY_ALL_PACKAGES` | `Installed apps` | review | Android: "query of any normal app". Google: "apps installed on" |

Every other permission, including `INTERNET`, has no entry and is not reported; a note counts them. A permission written with a placeholder or a custom name is not in the table either.

## SDKs

An SDK is matched by the exact `group:artifact` of a dependency, letter case included. Only dependencies of the app are read: the test configurations (`testImplementation`, `androidTestImplementation` and the like) are left out. The data types are those the vendor's own page lists for the SDK, put under the data type of Google's page that describes them. "Automatic" is data the vendor lists as collected by default; "usage" is data the vendor lists as depending on how the SDK is used. A vendor page that could not be opened is not used, and its SDK is not in the table.

| SDK | Coordinates |
| --- | --- |
| Google Analytics for Firebase | `com.google.firebase:firebase-analytics`, `com.google.firebase:firebase-analytics-ktx` |
| Firebase Crashlytics | `com.google.firebase:firebase-crashlytics`, `com.google.firebase:firebase-crashlytics-ktx`, `com.google.firebase:firebase-crashlytics-ndk` |
| Firebase Authentication | `com.google.firebase:firebase-auth`, `com.google.firebase:firebase-auth-ktx` |
| Google Mobile Ads SDK | `com.google.android.gms:play-services-ads` |
| Maps SDK for Android | `com.google.android.gms:play-services-maps` |

| SDK | Data type | The vendor's label for the data | Google's description | When |
| --- | --- | --- | --- | --- |
| Google Analytics for Firebase | `Device or other IDs` | "App-instance ID", "Advertising ID" | "advertising identifier" | automatic |
| Google Analytics for Firebase | `Approximate location` | "Masked IP address" | "inferred, such as via IP address" | automatic |
| Google Analytics for Firebase | `Purchase history` | "In-app purchases and subscriptions" | "purchases or transactions" | automatic |
| Google Analytics for Firebase | `App interactions` | "App lifecycle events" | "number of times they visit a page" | automatic |
| Firebase Crashlytics | `Crash logs` | "Stack traces" | "stack traces" | automatic |
| Firebase Crashlytics | `Device or other IDs` | "Crashlytics installation UUID" | "individual device, browser or app" | automatic |
| Firebase Authentication | `User IDs` | "unique Firebase Authentication identifier" | "Identifiers that relate to an identifiable person" | usage |
| Google Mobile Ads SDK | `Device or other IDs` | "Device and Account identifiers" | "advertising identifier" | automatic |
| Google Mobile Ads SDK | `App interactions` | "User product interactions" | "how a user interacts with the app" | automatic |
| Google Mobile Ads SDK | `Diagnostics` | "Diagnostic information" | "performance of your app" | automatic |
| Google Mobile Ads SDK | `Approximate location` | "IP address" | "inferred, such as via IP address" | automatic |
| Maps SDK for Android | `Crash logs` | "Stack traces" | "stack traces" | automatic |
| Maps SDK for Android | `Device or other IDs` | "Maps SDK identifier" | "individual device, browser or app" | automatic |

Each SDK of the table gives one finding per data type that the answers do not list (`sdk-undeclared`), or list as neither collected nor shared (`declared-not-collected`), both warnings, with the vendor's page in the fix. The vendors' pages describe their latest versions and change; an older version may collect something else, and the vendor's page, not this table, is the one to read for yours. Google's page says the form must also account for the data its libraries and SDKs send off the device, and that the SDK providers' own disclosures are where to look.

SDKs not in the table are not reported. Many are missing, among them the location library of Google Play services and the sign-in SDKs: no data disclosure page of their vendors was found, so they were left out. Add one by following [CONTRIBUTING.md](../CONTRIBUTING.md).
