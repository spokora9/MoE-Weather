/// AdMob unit ID configuration.
///
/// In development / debug builds (and whenever `--dart-define` env vars are
/// not provided) we fall back to Google's documented test ad unit IDs so that
/// developers never accidentally hit real AdMob inventory.
///
/// In production builds the orchestrator is expected to inject real AdMob IDs
/// via `--dart-define` at build time, e.g.:
///
/// ```bash
/// flutter build apk \
///   --dart-define=ADMOB_APP_ID_ANDROID=ca-app-pub-XXX~YYY \
///   --dart-define=ADMOB_BANNER_ANDROID=ca-app-pub-XXX/YYY \
///   --dart-define=ADMOB_INTERSTITIAL_ANDROID=ca-app-pub-XXX/YYY
/// ```
library;

import 'dart:io' show Platform;

/// Google's official test ad unit IDs.
/// See: https://developers.google.com/admob/flutter/test-ads
class TestAdUnitIds {
  TestAdUnitIds._();

  // Sample App IDs (used as fallback in the platform manifest entry).
  static const String appIdAndroid = 'ca-app-pub-3940256099942544~3347511713';
  static const String appIdIos = 'ca-app-pub-3940256099942544~1458002511';

  // Banner test IDs.
  static const String bannerAndroid = 'ca-app-pub-3940256099942544/6300978111';
  static const String bannerIos = 'ca-app-pub-3940256099942544/2934735716';

  // Interstitial test IDs.
  static const String interstitialAndroid =
      'ca-app-pub-3940256099942544/1033173712';
  static const String interstitialIos =
      'ca-app-pub-3940256099942544/4411468910';
}

/// Reads an environment variable supplied via `--dart-define` at build time.
const String _envAppIdAndroid = String.fromEnvironment('ADMOB_APP_ID_ANDROID');
const String _envAppIdIos = String.fromEnvironment('ADMOB_APP_ID_IOS');
const String _envBannerAndroid = String.fromEnvironment('ADMOB_BANNER_ANDROID');
const String _envBannerIos = String.fromEnvironment('ADMOB_BANNER_IOS');
const String _envInterstitialAndroid =
    String.fromEnvironment('ADMOB_INTERSTITIAL_ANDROID');
const String _envInterstitialIos =
    String.fromEnvironment('ADMOB_INTERSTITIAL_IOS');

/// Resolves AdMob unit IDs for the current platform, falling back to Google's
/// documented test IDs when build-time env vars are absent.
///
/// All getters are pure and safe to call from `initState` / `build`.
class AdsConfig {
  /// Allow callers (mainly tests) to override the runtime platform detection
  /// without coupling to `dart:io`.
  AdsConfig({bool? isIosOverride, bool? isAndroidOverride})
      : _isIosOverride = isIosOverride,
        _isAndroidOverride = isAndroidOverride;

  final bool? _isIosOverride;
  final bool? _isAndroidOverride;

  bool get _isIos => _isIosOverride ?? Platform.isIOS;
  bool get _isAndroid => _isAndroidOverride ?? Platform.isAndroid;

  /// AdMob "App ID" - referenced by the platform manifest (Info.plist on iOS,
  /// AndroidManifest.xml on Android). Not used directly by the SDK at runtime,
  /// but exposed here for completeness and template generation.
  String get appId {
    if (_isIos) {
      return _envAppIdIos.isNotEmpty ? _envAppIdIos : TestAdUnitIds.appIdIos;
    }
    if (_isAndroid) {
      return _envAppIdAndroid.isNotEmpty
          ? _envAppIdAndroid
          : TestAdUnitIds.appIdAndroid;
    }
    // Fallback for desktop / web (ads aren't supported there but unit tests
    // still need a deterministic value).
    return TestAdUnitIds.appIdAndroid;
  }

  /// Banner ad unit ID for the current platform.
  String get bannerAdUnitId {
    if (_isIos) {
      return _envBannerIos.isNotEmpty
          ? _envBannerIos
          : TestAdUnitIds.bannerIos;
    }
    if (_isAndroid) {
      return _envBannerAndroid.isNotEmpty
          ? _envBannerAndroid
          : TestAdUnitIds.bannerAndroid;
    }
    return TestAdUnitIds.bannerAndroid;
  }

  /// Interstitial ad unit ID for the current platform.
  String get interstitialAdUnitId {
    if (_isIos) {
      return _envInterstitialIos.isNotEmpty
          ? _envInterstitialIos
          : TestAdUnitIds.interstitialIos;
    }
    if (_isAndroid) {
      return _envInterstitialAndroid.isNotEmpty
          ? _envInterstitialAndroid
          : TestAdUnitIds.interstitialAndroid;
    }
    return TestAdUnitIds.interstitialAndroid;
  }

  /// `true` when the active ad unit IDs are the public Google test IDs.
  bool get usingTestIds {
    if (_isIos) {
      return _envBannerIos.isEmpty && _envInterstitialIos.isEmpty;
    }
    if (_isAndroid) {
      return _envBannerAndroid.isEmpty && _envInterstitialAndroid.isEmpty;
    }
    return true;
  }
}

/// Default singleton-style accessor. Tests may construct their own
/// `AdsConfig` with platform overrides.
final AdsConfig adsConfig = AdsConfig();
