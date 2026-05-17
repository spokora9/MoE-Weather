# MoE Weather — Flutter App

Mobile client for the MoE Weather API. Targets iOS 13.0+ and Android API 21+.

## Stack

- **State**: Riverpod 3
- **Networking**: Dio
- **Local storage**: Hive
- **Models**: freezed + json_serializable (code-generated)
- **Lints**: flutter_lints

## Folder structure

```
lib/
  api/                  Generated Dio client + request/response models
  core/
    theme/              ColorScheme, typography, dark/light themes
    animations/         Lottie loaders, page transitions
    utils/              Shared utilities
  features/
    auth/               Sign-in screens, Supabase + RevenueCat tier
    forecast/           Current + hourly + daily forecast UI
    specialty/          Air quality, marine, astronomy
    settings/           Unit preferences, app settings
    locations/          Saved location manager
    notifications/      FCM + local push handlers
    onboarding/         First-run flow
    ads/                AdMob banners + interstitials (free tier)
  main.dart
```

## Running

```bash
flutter pub get
flutter run                 # connects to a simulator/emulator
flutter test                # widget tests
flutter analyze             # lint
```

## Code generation

```bash
dart run build_runner build --delete-conflicting-outputs
```

## Platform configuration

- **iOS deployment target**: 13.0 (`ios/Runner.xcodeproj/project.pbxproj`)
- **Android minSdk**: 21 (`android/app/build.gradle.kts`)
- **Bundle ID / Application ID**: `com.moeweather.app`

## Home screen widgets

See `docs/WIDGET_STRATEGY.md` at the repo root for the iOS WidgetKit + Android Glance approach. Implemented by Wave 3 Phase H Agent H4.
