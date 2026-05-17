# H4 — Home Screen Widgets: Manual Setup Guide

This file documents the manual steps required to wire the widget extension into
Xcode (iOS) and Android's Gradle build (Android). The Dart/Flutter side is
already implemented — see the other files in this directory.

---

## Flutter `main.dart` initialization

Add the following to your `main()` before `runApp`:

```dart
import 'package:moe_weather/features/widgets/widget_data_service.dart';
import 'package:moe_weather/features/widgets/widget_update_scheduler.dart';
import 'package:workmanager/workmanager.dart';

// Inside main():
await WidgetDataService.initialize();

// Android only — register the background callback once:
if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
  await Workmanager().initialize(callbackDispatcher);
  await scheduleWidgetRefresh();
}
```

Define the `callbackDispatcher` top-level function (required by WorkManager):

```dart
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    // Re-fetch weather from cache / API and push to widget.
    // Return true when done, false on failure.
    return true;
  });
}
```

---

## iOS — Xcode manual steps

### 1. Add Widget Extension target

1. Open `ios/Runner.xcworkspace` in Xcode.
2. **File > New > Target** → choose **Widget Extension**.
3. Set **Product Name**: `WeatherWidgetExtension`.
4. Set **Bundle Identifier**: `com.moeweather.app.WeatherWidgetExtension`.
5. Uncheck *Include Configuration Intent*.
6. Click **Finish** and activate the scheme when prompted.

### 2. Add source files to the target

Drag the four Swift files from `ios/Runner/WeatherWidgetExtension/` into the
newly created `WeatherWidgetExtension` group in Xcode. Make sure each file is
checked under **Target Membership → WeatherWidgetExtension only** (not Runner).

### 3. App Group capability

Enable the App Group on **both** the `Runner` target and the
`WeatherWidgetExtension` target:

1. Select **Runner** target → **Signing & Capabilities** → **+ Capability** →
   **App Groups**.
2. Add: `group.com.moeweather.app`.
3. Repeat for the **WeatherWidgetExtension** target.

### 4. Podfile entry

The `home_widget` pod must be linked only to the main app target. The widget
extension has no Flutter dependency. Ensure `ios/Podfile` contains:

```ruby
target 'Runner' do
  use_frameworks!
  use_modular_headers!
  flutter_install_all_ios_pods File.dirname(File.realpath(__FILE__))
end

# No pods needed for WeatherWidgetExtension — it uses only system WidgetKit.
```

Run `pod install` after any Podfile change.

---

## Android — manual steps

### 1. Add Glance dependency in `android/app/build.gradle.kts`

```kotlin
dependencies {
    // Glance for App Widgets (Compose-based)
    implementation("androidx.glance:glance-appwidget:1.1.0")
    implementation("androidx.glance:glance-material3:1.1.0")

    // WorkManager for background refresh
    implementation("androidx.work:work-runtime-ktx:2.9.0")
}
```

### 2. Register receiver in `android/app/src/main/AndroidManifest.xml`

Inside the `<application>` block, add:

```xml
<receiver
    android:name="com.moeweather.app.widgets.WeatherWidgetReceiver"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/weather_widget_info" />
</receiver>
```

### 3. WorkManager initialization (Application class)

If you do not have a custom `Application` class, create
`android/app/src/main/kotlin/com/moeweather/moe_weather/MoeWeatherApplication.kt`:

```kotlin
package com.moeweather.moe_weather

import android.app.Application
import androidx.work.Configuration

class MoeWeatherApplication : Application(), Configuration.Provider {
    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder().build()
}
```

Register it in `AndroidManifest.xml`:

```xml
<application
    android:name=".MoeWeatherApplication"
    ...>
```

---

## Notes

- **Pro-only gate**: `pushWeatherToWidget` in `widget_provider.dart` silently
  returns `false` for free/anonymous users. No widget data is written.
- **Android key prefix**: `home_widget` writes to `SharedPreferences` with the
  `flutter.` prefix. `WeatherWidget.kt` reads from the same prefs file
  (`FlutterSharedPreferences`) using that prefix.
- **iOS refresh**: WidgetKit automatically reloads the timeline every hour via
  `.after(next)` policy. No explicit push is needed beyond the Flutter
  `HomeWidget.updateWidget(...)` call.
