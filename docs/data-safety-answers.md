# The Data safety answers file

Google Play asks every app for a Data safety form in Play Console. The answers are given in a web form there, and nothing in a repository says what they were. This tool reads the answers from a small JSON file that you keep next to the code and update in the same pull request as the change that needs it. By default the file is `data-safety.json` in the folder you give; `--answers <file>` names another one.

The file records what you answer in the form. It does not replace the form, and the tool never talks to Play Console.

## Format

```json
{
  "dataTypes": [
    {
      "type": "Precise location",
      "collected": true,
      "shared": false,
      "purposes": ["App functionality"]
    },
    {
      "type": "Contacts",
      "collected": false,
      "shared": false
    }
  ]
}
```

The top value is an object with one key, `dataTypes`, an array. A `$schema` key is accepted and ignored. Any other key is reported as `malformed-entry` and ignored.

Each entry of `dataTypes` is an object with these keys:

| Key | Type | Meaning |
| --- | --- | --- |
| `type` | string | The name of a data type, written exactly as in the table below (letter case included). |
| `collected` | true or false | Google's page says "collect" means transmitting data from your app off a user's device, including by the libraries and SDKs in the app. |
| `shared` | true or false | Google's page says "sharing" means transferring user data collected from your app to a third party, with the exceptions the page lists. |
| `purposes` | array of strings | The purposes of the collection or sharing, written exactly as in the list below. Needed when `collected` or `shared` is true. |

An entry with `collected` and `shared` both false says: this data type is neither collected nor shared. A data type that is not listed at all says nothing, and the tool reads it as "not answered". A missing `collected` or `shared` is read as false and reported as `malformed-entry`. Any other key in an entry is reported as `malformed-entry` and ignored.

The file is read as strict JSON: no comments, no trailing commas, no single quotes, and no key twice in one object. Where the file is not JSON, or its top value is not an object with a `dataTypes` array, the run reports `answers-invalid` with the line of the fault. Where the file is missing, it reports `answers-missing`.

The form asks more than this: whether data is optional or required, whether it is encrypted in transit, whether users can ask for deletion, and the badges. None of that is read or checked.

## Data types

These are the data types of the form, in the order of Google's table, with their categories. The text is from the page saved in [research/sources/data-safety-section.txt](../research/sources/data-safety-section.txt), and a test compares `src/data.js` with it. The source address is on the first line of that file: https://support.google.com/googleplay/android-developer/answer/10787469

| Category | Data type |
| --- | --- |
| Location | `Approximate location` |
| Location | `Precise location` |
| Personal info | `Name` |
| Personal info | `Email address` |
| Personal info | `User IDs` |
| Personal info | `Address` |
| Personal info | `Phone number` |
| Personal info | `Race and ethnicity` |
| Personal info | `Political or religious beliefs` |
| Personal info | `Sexual orientation` |
| Personal info | `Other info` |
| Financial info | `User payment info` |
| Financial info | `Purchase history` |
| Financial info | `Credit score` |
| Financial info | `Other financial info` |
| Health and fitness | `Health info` |
| Health and fitness | `Fitness info` |
| Messages | `Emails` |
| Messages | `SMS or MMS` |
| Messages | `Other in-app messages` |
| Photos and videos | `Photos` |
| Photos and videos | `Videos` |
| Audio files | `Voice or sound recordings` |
| Audio files | `Music files` |
| Audio files | `Other audio files` |
| Files and docs | `Files and docs` |
| Calendar | `Calendar events` |
| Contacts | `Contacts` |
| App activity | `App interactions` |
| App activity | `In-app search history` |
| App activity | `Installed apps` |
| App activity | `Other user-generated content` |
| App activity | `Other actions` |
| Web browsing | `Web browsing history` |
| App info and performance | `Crash logs` |
| App info and performance | `Diagnostics` |
| App info and performance | `Other app performance data` |
| Device or other IDs | `Device or other IDs` |

The category is not written in the file; only the data type name is. A name that is not in this table is reported as `unknown-data-type`, and so is the same name in another letter case.

## Purposes

| Purpose | Google's description |
| --- | --- |
| `App functionality` | Used for features that are available in the app |
| `Analytics` | Used to collect data about how users use the app or how it performs |
| `Developer communications` | Used to send news or notifications about the app or the developer |
| `Advertising or marketing` | Used to display or target ads or marketing communications, or measuring ad performance |
| `Fraud prevention, security, and compliance` | Used for fraud prevention, security, or compliance with laws |
| `Personalization` | Used to customize your app, such as showing recommended content or suggestions |
| `Account management` | Used for the setup or management of a user's account with the developer |

A name that is not in this table is reported as `unknown-purpose`.

## What the checks do with it

- A data type with `collected` or `shared` true and no purpose is an error (`no-purpose`).
- A name that Google does not list is a warning (`unknown-data-type`, `unknown-purpose`), and the same data type twice is a warning (`duplicate-type`).
- The data types are compared with the permissions of the manifests and the SDKs of the Gradle files; [method.md](method.md) says how, and [permissions-and-sdks.md](permissions-and-sdks.md) lists the mappings.
