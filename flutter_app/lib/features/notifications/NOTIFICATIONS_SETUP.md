# Push Notifications Setup Guide

## 1. Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project (or use an existing one).
2. Add an **Android** app with package name `com.moeweather.app`.
3. Add an **iOS** app with bundle ID `com.moeweather.app`.
4. Download the respective config files (see steps 2 and 3 below).

## 2. Android Setup

1. Download `google-services.json` from the Firebase console and place it at:
   ```
   android/app/google-services.json
   ```
2. In `android/build.gradle.kts` (project-level), add the Google Services plugin to the `plugins` block:
   ```kotlin
   id("com.google.gms.google-services") version "4.4.2" apply false
   ```
3. In `android/app/build.gradle.kts` (app-level), apply the plugin:
   ```kotlin
   id("com.google.gms.google-services")
   ```

## 3. iOS Setup

1. Download `GoogleService-Info.plist` from the Firebase console and add it to:
   ```
   ios/Runner/GoogleService-Info.plist
   ```
   (Add it via Xcode so it is included in the Runner target.)
2. In Xcode, open `ios/Runner.xcworkspace` and under **Runner → Signing & Capabilities**:
   - Add **Push Notifications** capability.
   - Add **Background Modes** capability and enable **Remote notifications**.

## 4. Flutter `main.dart` Initialization

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:moe_weather/features/notifications/notification_provider.dart';
import 'package:moe_weather/features/notifications/local_notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(const ProviderScope(child: MyApp()));
}

// In your root widget's Consumer build method:
// ref.read(notificationBridgeProvider);
// ref.read(localNotificationServiceProvider).initialize();
```

Example root widget:

```dart
class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Activate FCM + local notification bridge once at startup.
    ref.read(notificationBridgeProvider);
    ref.read(localNotificationServiceProvider).initialize();

    return MaterialApp(
      title: 'MoE Weather',
      home: const HomeScreen(),
    );
  }
}
```
