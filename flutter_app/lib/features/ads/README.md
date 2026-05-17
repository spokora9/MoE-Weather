# Ads (AdMob) feature

Banner + interstitial integration for the **free tier**. Pro users never see
ads.

## Files

| File | Purpose |
| --- | --- |
| `ads_config.dart` | Resolves the correct ad unit ID per platform. Test IDs (Google's documented samples) are baked in; production IDs come from `--dart-define`. |
| `ads_tier_provider.dart` | Indirection layer so this feature doesn't import auth / subscription code directly. |
| `ads_service.dart` | `AdsService.ensureInitialized()`, `BannerAdWidget`, `InterstitialAdController`. |

## Test vs production ad unit IDs

By default the code returns Google's public test IDs. To inject real IDs at
build time, pass `--dart-define` keys:

```bash
flutter build apk \
  --dart-define=ADMOB_APP_ID_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY \
  --dart-define=ADMOB_BANNER_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY \
  --dart-define=ADMOB_INTERSTITIAL_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY

flutter build ios \
  --dart-define=ADMOB_APP_ID_IOS=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY \
  --dart-define=ADMOB_BANNER_IOS=ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY \
  --dart-define=ADMOB_INTERSTITIAL_IOS=ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY
```

When none of these are set the helper transparently falls back to:

| Platform | Banner | Interstitial |
| --- | --- | --- |
| Android | `ca-app-pub-3940256099942544/6300978111` | `ca-app-pub-3940256099942544/1033173712` |
| iOS | `ca-app-pub-3940256099942544/2934735716` | `ca-app-pub-3940256099942544/4411468910` |

`AdsConfig.usingTestIds` returns `true` whenever the test fallbacks are
active, which is useful for analytics / telemetry tagging.

## Wiring the tier resolver at app boot

This feature must NOT `import 'package:moe_weather/features/auth/...'` because
the auth / subscription branch (G3 / wave1-C4) may not yet be merged when
this code lands.

Instead, the orchestrator wires a resolver function once at startup:

```dart
// in lib/main.dart (orchestrator-owned)
import 'package:moe_weather/features/ads/ads_tier_provider.dart';
import 'package:moe_weather/features/auth/tier_provider.dart'; // G3

void main() {
  setIsProResolver((ref) => ref.read(tierProvider) == Tier.pro);
  runApp(const ProviderScope(child: MyApp()));
}
```

Until that call happens (or in unit/widget tests) the resolver defaults to
"everyone is free", so the ads feature degrades safely.

## iOS - Info.plist

Add the `GADApplicationIdentifier` key. Use the **test** App ID during
development and replace it with your real App ID before release:

```xml
<!-- ios/Runner/Info.plist -->
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-3940256099942544~1458002511</string>

<key>SKAdNetworkItems</key>
<array>
  <dict>
    <key>SKAdNetworkIdentifier</key>
    <string>cstr6suwn9.skadnetwork</string>
  </dict>
  <!-- ...add the rest of Google's documented SKAdNetwork IDs... -->
</array>
```

## Android - AndroidManifest.xml

Add the `<meta-data>` tag inside `<application>`:

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<application ...>
  <meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-3940256099942544~3347511713"/>
  <!-- ...the rest of your manifest... -->
</application>
```

For release builds, swap the value for your real App ID, ideally via a build
variant / `manifestPlaceholders` so it stays out of source control.

## iOS - App Tracking Transparency (ATT)

AdMob personalised ads on iOS 14.5+ require an ATT permission prompt. The
prompt should be shown **before** the first `MobileAds.instance.initialize()`
call so that the SDK can pick up the user's choice.

Recommended placement:

1. After onboarding / first launch screen, before the home shell renders.
2. Use the `app_tracking_transparency` package (owned by another track) to
   request authorization.
3. Then call `AdsService.ensureInitialized()` from the ads feature.

Add the usage description to `ios/Runner/Info.plist`:

```xml
<key>NSUserTrackingUsageDescription</key>
<string>This identifier will be used to deliver personalized ads to you.</string>
```

If the user denies ATT, AdMob falls back to non-personalised ads
automatically - no further code changes required.
