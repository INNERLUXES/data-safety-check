// The tables the checks are built on. The data types and purposes are those of Google's Data safety help page,
// the permission names are those of the Android reference page for Manifest.permission, and the SDK rows come
// from the data disclosure pages of the SDK vendors. The text each one comes from is kept in research/sources,
// and test/data.test.js compares these tables with it, so a change in one without the other fails.
// docs/permissions-and-sdks.md shows the mappings as tables.
//
// Every mapping is indicative. Google's page says an app does not declare data it does not collect or share, so
// a permission or an SDK can only point at a data type; whether the app really collects it is for its authors
// to say. level 'direct' means the permission gives direct read access to data that Google's page defines as
// that data type; level 'review' means the permission is a capability that may or may not produce data of that
// type, or can map to more than one type.

const SUPPORT = 'https://support.google.com/googleplay/android-developer/answer/10787469';

export const SOURCES = [
  { name: 'Provide information for Google Play\'s Data safety section', url: SUPPORT, file: 'data-safety-section' },
  { name: 'Manifest.permission', url: 'https://developer.android.com/reference/android/Manifest.permission', file: 'manifest-permission' },
  { name: 'Google Analytics for Firebase SDK', url: 'https://support.google.com/analytics/answer/11582702', file: 'sdk-google-analytics-for-firebase' },
  { name: 'Firebase Android SDKs', url: 'https://firebase.google.com/docs/android/play-data-disclosure', file: 'sdk-firebase-play-data-disclosure' },
  { name: 'Google Mobile Ads SDK', url: 'https://developers.google.com/admob/android/privacy/play-data-disclosure', file: 'sdk-google-mobile-ads' },
  { name: 'Maps SDK for Android', url: 'https://developers.google.com/maps/documentation/android-sdk/play-data-disclosure', file: 'sdk-maps-sdk-for-android' }
];

export const ANSWERS_FILE = 'data-safety.json';
export const MANIFEST_NAME = 'AndroidManifest.xml';

// The categories and data types of the Data safety form, in the order of Google's table.
export const CATEGORIES = [
  { name: 'Location', types: ['Approximate location', 'Precise location'] },
  { name: 'Personal info', types: ['Name', 'Email address', 'User IDs', 'Address', 'Phone number', 'Race and ethnicity', 'Political or religious beliefs', 'Sexual orientation', 'Other info'] },
  { name: 'Financial info', types: ['User payment info', 'Purchase history', 'Credit score', 'Other financial info'] },
  { name: 'Health and fitness', types: ['Health info', 'Fitness info'] },
  { name: 'Messages', types: ['Emails', 'SMS or MMS', 'Other in-app messages'] },
  { name: 'Photos and videos', types: ['Photos', 'Videos'] },
  { name: 'Audio files', types: ['Voice or sound recordings', 'Music files', 'Other audio files'] },
  { name: 'Files and docs', types: ['Files and docs'] },
  { name: 'Calendar', types: ['Calendar events'] },
  { name: 'Contacts', types: ['Contacts'] },
  { name: 'App activity', types: ['App interactions', 'In-app search history', 'Installed apps', 'Other user-generated content', 'Other actions'] },
  { name: 'Web browsing', types: ['Web browsing history'] },
  { name: 'App info and performance', types: ['Crash logs', 'Diagnostics', 'Other app performance data'] },
  { name: 'Device or other IDs', types: ['Device or other IDs'] }
];

export const DATA_TYPES = CATEGORIES.flatMap((c) => c.types);

export const PURPOSES = [
  'App functionality',
  'Analytics',
  'Developer communications',
  'Advertising or marketing',
  'Fraud prevention, security, and compliance',
  'Personalization',
  'Account management'
];

const TYPE_SET = new Set(DATA_TYPES);
const PURPOSE_SET = new Set(PURPOSES);

export function isDataType(name) {
  return TYPE_SET.has(name);
}

export function isPurpose(name) {
  return PURPOSE_SET.has(name);
}

export function categoryOf(type) {
  const found = CATEGORIES.find((c) => c.types.includes(type));
  return found ? found.name : null;
}

export const PERMISSION_PREFIX = 'android.permission.';

// permission: the name after android.permission.; types: the data types it can point at (any one of them
// answers the question); level: 'direct' or 'review'; page: a phrase of Google's description of those types;
// android: a phrase of the Android reference text of the permission.
export const PERMISSIONS = [
  { permission: 'ACCESS_FINE_LOCATION', types: ['Precise location'], level: 'direct', page: 'ACCESS_FINE_LOCATION permission', android: 'access precise location' },
  { permission: 'ACCESS_COARSE_LOCATION', types: ['Approximate location'], level: 'direct', page: 'ACCESS_COARSE_LOCATION permission', android: 'access approximate location' },
  { permission: 'READ_CONTACTS', types: ['Contacts'], level: 'direct', page: 'contacts such as contact names', android: 'read the user\'s contacts data' },
  { permission: 'READ_CALL_LOG', types: ['Contacts'], level: 'direct', page: 'call history', android: 'read the user\'s call log' },
  { permission: 'READ_CALENDAR', types: ['Calendar events'], level: 'direct', page: 'calendar such as events', android: 'read the user\'s calendar data' },
  { permission: 'READ_SMS', types: ['SMS or MMS'], level: 'direct', page: 'text messages', android: 'read SMS messages' },
  { permission: 'RECEIVE_SMS', types: ['SMS or MMS'], level: 'direct', page: 'text messages', android: 'receive SMS messages' },
  { permission: 'READ_PHONE_NUMBERS', types: ['Phone number'], level: 'review', page: 'phone number', android: 'phone number(s)' },
  { permission: 'CAMERA', types: ['Photos', 'Videos'], level: 'review', page: 'photos', android: 'access the camera device' },
  { permission: 'RECORD_AUDIO', types: ['Voice or sound recordings'], level: 'review', page: 'sound recording', android: 'record audio' },
  { permission: 'BODY_SENSORS', types: ['Health info', 'Fitness info'], level: 'review', page: 'medical records or symptoms', android: 'heart rate' },
  { permission: 'BODY_SENSORS_BACKGROUND', types: ['Health info', 'Fitness info'], level: 'review', page: 'medical records or symptoms', android: 'heart rate' },
  { permission: 'ACTIVITY_RECOGNITION', types: ['Fitness info'], level: 'review', page: 'exercise or other physical activity', android: 'recognize physical activity' },
  { permission: 'GET_ACCOUNTS', types: ['User IDs', 'Email address'], level: 'review', page: 'account name', android: 'list of accounts' },
  { permission: 'READ_MEDIA_IMAGES', types: ['Photos'], level: 'review', page: 'photos', android: 'read image files' },
  { permission: 'READ_MEDIA_VIDEO', types: ['Videos'], level: 'review', page: 'videos', android: 'read video files' },
  { permission: 'READ_MEDIA_AUDIO', types: ['Music files', 'Other audio files'], level: 'review', page: 'music files', android: 'read audio files' },
  { permission: 'READ_EXTERNAL_STORAGE', types: ['Files and docs'], level: 'review', page: 'files or documents', android: 'read from external storage' },
  { permission: 'QUERY_ALL_PACKAGES', types: ['Installed apps'], level: 'review', page: 'apps installed on', android: 'query of any normal app' }
];

const PERMISSION_MAP = new Map(PERMISSIONS.map((p) => [`${PERMISSION_PREFIX}${p.permission}`, p]));

// Looks a manifest permission name up exactly (case included); null when the table has no mapping for it.
export function permissionByName(name) {
  return PERMISSION_MAP.get(name) ?? null;
}

// Indicative table of well-known SDKs. coordinates: group:artifact, compared exactly. source: the file in
// research/sources that holds the vendor page. types: the data types the SDK points at; vendor: the labels the
// vendor's own page gives to the data (each must appear in the saved page); page: a phrase of Google's
// description of the data type; when: 'automatic' for data the vendor lists as collected by default, 'usage'
// for data it lists as depending on how the SDK is used.
export const SDKS = [
  {
    id: 'firebase-analytics',
    name: 'Google Analytics for Firebase',
    kind: 'analytics',
    coordinates: ['com.google.firebase:firebase-analytics', 'com.google.firebase:firebase-analytics-ktx'],
    listedIn: 'sdk-firebase-play-data-disclosure',
    source: 'sdk-google-analytics-for-firebase',
    types: [
      { type: 'Device or other IDs', vendor: ['App-instance ID', 'Advertising ID'], page: 'advertising identifier', when: 'automatic' },
      { type: 'Approximate location', vendor: ['Masked IP address'], page: 'inferred, such as via IP address', when: 'automatic' },
      { type: 'Purchase history', vendor: ['In-app purchases and subscriptions'], page: 'purchases or transactions', when: 'automatic' },
      { type: 'App interactions', vendor: ['App lifecycle events'], page: 'number of times they visit a page', when: 'automatic' }
    ]
  },
  {
    id: 'firebase-crashlytics',
    name: 'Firebase Crashlytics',
    kind: 'crash reporting',
    coordinates: ['com.google.firebase:firebase-crashlytics', 'com.google.firebase:firebase-crashlytics-ktx', 'com.google.firebase:firebase-crashlytics-ndk'],
    listedIn: 'sdk-firebase-play-data-disclosure',
    source: 'sdk-firebase-play-data-disclosure',
    types: [
      { type: 'Crash logs', vendor: ['Stack traces'], page: 'stack traces', when: 'automatic' },
      { type: 'Device or other IDs', vendor: ['Crashlytics installation UUID'], page: 'individual device, browser or app', when: 'automatic' }
    ]
  },
  {
    id: 'firebase-auth',
    name: 'Firebase Authentication',
    kind: 'auth',
    coordinates: ['com.google.firebase:firebase-auth', 'com.google.firebase:firebase-auth-ktx'],
    listedIn: 'sdk-firebase-play-data-disclosure',
    source: 'sdk-firebase-play-data-disclosure',
    types: [
      { type: 'User IDs', vendor: ['unique Firebase Authentication identifier'], page: 'Identifiers that relate to an identifiable person', when: 'usage' }
    ]
  },
  {
    id: 'google-mobile-ads',
    name: 'Google Mobile Ads SDK',
    kind: 'ads',
    coordinates: ['com.google.android.gms:play-services-ads'],
    listedIn: 'sdk-google-mobile-ads',
    source: 'sdk-google-mobile-ads',
    types: [
      { type: 'Device or other IDs', vendor: ['Device and Account identifiers'], page: 'advertising identifier', when: 'automatic' },
      { type: 'App interactions', vendor: ['User product interactions'], page: 'how a user interacts with the app', when: 'automatic' },
      { type: 'Diagnostics', vendor: ['Diagnostic information'], page: 'performance of your app', when: 'automatic' },
      { type: 'Approximate location', vendor: ['IP address'], page: 'inferred, such as via IP address', when: 'automatic' }
    ]
  },
  {
    id: 'maps-sdk-android',
    name: 'Maps SDK for Android',
    kind: 'maps',
    coordinates: ['com.google.android.gms:play-services-maps'],
    listedIn: 'sdk-maps-sdk-for-android',
    source: 'sdk-maps-sdk-for-android',
    types: [
      { type: 'Crash logs', vendor: ['Stack traces'], page: 'stack traces', when: 'automatic' },
      { type: 'Device or other IDs', vendor: ['Maps SDK identifier'], page: 'individual device, browser or app', when: 'automatic' }
    ]
  }
];

const SDK_MAP = new Map(SDKS.flatMap((s) => s.coordinates.map((c) => [c, s])));

// Looks a coordinate (group:artifact) up exactly; null when the table has no SDK for it.
export function sdkByCoordinate(coordinate) {
  return SDK_MAP.get(coordinate) ?? null;
}
