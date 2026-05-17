# Home Screen Widget Strategy

Plan for the iOS + Android home-screen widgets owned by Wave 3 Phase H Agent H4. Widgets are a Pro-tier feature.

## Why widgets matter

A weather app's home-screen widget is the single most-frequented surface — most users glance at it 10–30 times a day without opening the app. The widget must:

- Load in under 200ms
- Show current temperature, conditions icon, and today's high/low at minimum
- Refresh in the background without draining battery
- Tap-through to deep-link into the relevant location in the app

## Strategy by platform

### iOS — WidgetKit (iOS 14+)

**SwiftUI-only.** Cannot embed Flutter views in widgets. Widget extension is a separate target in Xcode that renders pure SwiftUI.

**Data flow:**
1. Flutter app writes the latest forecast snapshot to a shared App Group container as JSON when it fetches.
2. Widget extension's `TimelineProvider` reads that JSON via `UserDefaults(suiteName: "group.com.moeweather.app")` or a file in the shared container.
3. Background refresh: `WidgetCenter.shared.reloadAllTimelines()` is called from the Flutter side after a successful fetch via the `home_widget` pub package.
4. Independent fallback: when the app hasn't been opened in >2h, the widget can use a `BGAppRefreshTask` (registered in the main app) to hit the backend `/api/weather` endpoint directly and update the shared container. Backend auth uses a cached token stored in the keychain shared with the App Group.

**Sizes to support:**
- `systemSmall` — temperature + icon + city name
- `systemMedium` — adds today's high/low + next 4 hourly slots
- `systemLarge` — adds the 7-day strip (Pro only — `systemSmall`/`systemMedium` are also Pro, but Large is the showcase)
- `accessoryCircular` + `accessoryRectangular` lock-screen widgets (iOS 16+) — circular shows current temp; rectangular shows temp + condition

**Refresh policy:**
- Timeline returns entries for every 15 minutes for the next 4 hours, then hourly out to 12 hours.
- Background refresh is requested at the end of the timeline; iOS schedules adaptively.

**Deep-link:** Each timeline entry's `widgetURL(...)` carries `moeweather://forecast?locationId={uuid}`. Flutter's `uni_links` package handles routing.

### Android — Glance + Jetpack Compose (Android 12+)

**Glance is the modern path.** It renders to RemoteViews under the hood, so it runs in the launcher process — but the code is Compose. Older `AppWidgetProvider` + RemoteViews still works on Android 5+ if we need to support pre-Glance devices, but Glance is what we'll target.

**Data flow:**
1. Flutter writes the snapshot to shared preferences via `home_widget` (which on Android uses `SharedPreferences` keyed by widget provider).
2. The Glance `GlanceAppWidgetReceiver` reads the snapshot in `provideGlance()` and renders Compose composables.
3. Background refresh: `WorkManager` periodic task (every 30 min, with battery + network constraints) hits the backend if no recent snapshot exists, writes to SharedPreferences, and calls `GlanceAppWidgetManager.update()`.

**Sizes to support:**
- `1x1` — temp + icon
- `2x2` — adds high/low + city
- `4x2` — adds 4 hourly slots
- `4x4` — adds 7-day strip (Pro showcase)

**Refresh policy:**
- WorkManager periodic task every 30 min, with `setRequiredNetworkType(CONNECTED)` and `setRequiresBatteryNotLow(true)`.
- Manual refresh on app foregrounding via `GlanceAppWidgetManager.update()`.

**Deep-link:** Glance composables wrap content in `Modifier.clickable(actionStartActivity<MainActivity>(actionParametersOf("locationId" to uuid)))`. The `MainActivity` reads the param and forwards to Flutter via a method channel.

## Shared infrastructure

The `home_widget` Flutter package handles the cross-platform write surface:

```dart
await HomeWidget.saveWidgetData('temperatureC', forecast.current.temperatureC);
await HomeWidget.saveWidgetData('conditionIcon', forecast.current.condition);
await HomeWidget.saveWidgetData('highC', forecast.today.highC);
await HomeWidget.saveWidgetData('lowC', forecast.today.lowC);
await HomeWidget.saveWidgetData('locationName', forecast.location.name);
await HomeWidget.saveWidgetData('hourly', jsonEncode(forecast.hourly.take(4).toList()));
await HomeWidget.saveWidgetData('daily', jsonEncode(forecast.daily.take(7).toList()));
await HomeWidget.saveWidgetData('updatedAt', DateTime.now().toIso8601String());
await HomeWidget.updateWidget(
  iOSName: 'MoEWeatherWidget',
  androidName: 'MoEWeatherWidgetReceiver',
);
```

The same call updates both platforms.

## Tier enforcement

Widgets are Pro-only. Free users see a placeholder widget with "Upgrade to Pro" CTA. The widget extension reads the user's tier from the shared container — if `tier != "pro"`, it renders the upgrade UI instead of weather data. This avoids a code split.

## Edge cases

- **No location permission**: widget shows last known location or an "Open app to add a location" CTA
- **No network for >6h**: widget shows the stale snapshot with a small "Updated 6h ago" label
- **User signs out**: clear the shared container, widget shows "Sign in to MoE Weather"
- **Battery saver mode**: WorkManager respects this; iOS adaptively schedules. We don't override.

## Open questions

- Live Activities (iOS 16.1+) for active severe weather alerts — likely Wave 4 nice-to-have, not Wave 3 scope
- Dynamic Island variants — also Wave 4

## Implementation order for Agent H4

1. Add `home_widget` to `pubspec.yaml`, wire the write surface from the forecast feature
2. Create iOS Widget extension target in Xcode, share App Group `group.com.moeweather.app`
3. Build SwiftUI views for the three iOS sizes
4. Create Android Glance widget receiver + Compose layouts for 4 sizes
5. Wire deep-links on both platforms
6. Add WorkManager periodic refresh on Android and a `BGAppRefreshTask` registration on iOS
7. Gate behind Pro tier
