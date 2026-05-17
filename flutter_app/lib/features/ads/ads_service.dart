/// AdMob integration for the free tier.
///
/// This file exposes:
///   * [AdsService.ensureInitialized] - idempotent one-time init.
///   * [BannerAdWidget] - drop-in adaptive banner that hides itself for Pro.
///   * [InterstitialAdController] - shows an interstitial every Nth forecast
///     view; never shows for Pro users.
///
/// The ads feature is intentionally decoupled from the auth / subscription
/// stack: tier resolution flows through `ads_tier_provider.dart`.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'ads_config.dart';
import 'ads_tier_provider.dart';

/// Type aliases that the test suite swaps with mocktail fakes so we can
/// verify behaviour without actually initialising the AdMob SDK.
typedef MobileAdsInitializer = Future<InitializationStatus> Function();
typedef InterstitialAdLoader = Future<void> Function({
  required String adUnitId,
  required AdRequest request,
  required InterstitialAdLoadCallback adLoadCallback,
});

/// Service-level helpers for AdMob. Stateless / static by design - the SDK
/// itself is a process-wide singleton.
class AdsService {
  AdsService._();

  static bool _initialized = false;
  static Future<void>? _initFuture;

  /// Overrides used by tests to avoid touching the real AdMob SDK.
  @visibleForTesting
  static MobileAdsInitializer? debugInitializer;

  /// Calls `MobileAds.instance.initialize()` at most once per process.
  /// Safe to await from anywhere; subsequent calls return the same future.
  static Future<void> ensureInitialized() {
    if (_initialized) return Future<void>.value();
    return _initFuture ??= _doInitialize();
  }

  static Future<void> _doInitialize() async {
    final initializer = debugInitializer ?? MobileAds.instance.initialize;
    await initializer();
    _initialized = true;
  }

  /// Resets internal state. Tests only.
  @visibleForTesting
  static void resetForTesting() {
    _initialized = false;
    _initFuture = null;
    debugInitializer = null;
  }
}

/// A banner ad that:
///   * renders `SizedBox.shrink()` for Pro users (no layout shift surprises
///     because consumers can wrap it in any container they like);
///   * renders a fixed-height placeholder while the real `BannerAd` is loading
///     so the page doesn't jump when the ad arrives;
///   * loads an adaptive banner on first build and disposes it cleanly.
class BannerAdWidget extends ConsumerStatefulWidget {
  const BannerAdWidget({
    super.key,
    this.placeholderHeight = 50.0,
    this.adSize = AdSize.banner,
    @visibleForTesting this.debugSkipAdLoad = false,
  });

  /// Height reserved for the banner before/while it loads.
  final double placeholderHeight;

  /// Size of the banner ad to request.
  final AdSize adSize;

  /// When `true` we skip calling `BannerAd(...).load()`. The widget tree is
  /// still produced exactly as in production, just without touching the SDK.
  /// Tests set this to `true` so they can run in the Flutter test harness
  /// without an Android/iOS host.
  final bool debugSkipAdLoad;

  @override
  ConsumerState<BannerAdWidget> createState() => _BannerAdWidgetState();
}

class _BannerAdWidgetState extends ConsumerState<BannerAdWidget> {
  BannerAd? _bannerAd;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    if (!widget.debugSkipAdLoad) {
      _loadAd();
    }
  }

  void _loadAd() {
    final ad = BannerAd(
      adUnitId: adsConfig.bannerAdUnitId,
      size: widget.adSize,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (_) {
          if (mounted) setState(() => _loaded = true);
        },
        onAdFailedToLoad: (ad, error) {
          ad.dispose();
        },
      ),
    );
    _bannerAd = ad;
    // Don't await - banner loading is fire-and-forget.
    unawaited(ad.load());
  }

  @override
  void dispose() {
    _bannerAd?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (isProForRef(ref)) {
      return const SizedBox.shrink();
    }

    if (_loaded && _bannerAd != null) {
      return SizedBox(
        height: _bannerAd!.size.height.toDouble(),
        width: _bannerAd!.size.width.toDouble(),
        child: AdWidget(ad: _bannerAd!),
      );
    }

    // Placeholder reserves space so the UI doesn't jump when the ad loads.
    return SizedBox(
      height: widget.placeholderHeight,
      width: double.infinity,
      key: const ValueKey('banner_ad_placeholder'),
    );
  }
}

/// Tracks "forecast view" events and shows an interstitial every Nth call.
///
/// The controller deliberately does NOT depend on Riverpod state; it accepts
/// the pro-flag at call time so it can be used from imperative callbacks
/// (navigation observers, button taps, etc.).
class InterstitialAdController {
  InterstitialAdController({
    int showEvery = 5,
    AdsConfig? config,
    @visibleForTesting InterstitialAdLoader? loader,
    @visibleForTesting void Function(InterstitialAd ad)? debugShowAd,
  })  : assert(showEvery > 0, 'showEvery must be positive'),
        _showEvery = showEvery,
        _config = config ?? adsConfig,
        _loader = loader ?? _defaultLoader,
        _debugShowAd = debugShowAd;

  final int _showEvery;
  final AdsConfig _config;
  final InterstitialAdLoader _loader;
  final void Function(InterstitialAd ad)? _debugShowAd;

  int _eventCount = 0;
  InterstitialAd? _preloadedAd;
  bool _loadInFlight = false;

  /// Number of forecast-view events the controller has observed.
  @visibleForTesting
  int get eventCount => _eventCount;

  /// Whether an ad is currently cached and ready to show.
  bool get hasPreloadedAd => _preloadedAd != null;

  static Future<void> _defaultLoader({
    required String adUnitId,
    required AdRequest request,
    required InterstitialAdLoadCallback adLoadCallback,
  }) {
    return InterstitialAd.load(
      adUnitId: adUnitId,
      request: request,
      adLoadCallback: adLoadCallback,
    );
  }

  /// Records a forecast-view event. Returns `true` if an interstitial was
  /// shown (or scheduled to show) as a result.
  ///
  /// For Pro users this is a no-op and always returns `false`.
  bool showIfDue({required bool isPro}) {
    if (isPro) return false;

    _eventCount += 1;
    if (_eventCount % _showEvery != 0) {
      // Not due yet - opportunistically preload the next ad once we're past
      // the halfway mark so it's ready when the user reaches the threshold.
      if (_eventCount % _showEvery == _showEvery - 1) {
        _preloadAd();
      }
      return false;
    }

    final ad = _preloadedAd;
    if (ad == null) {
      // No ad cached - try to load one for next time and skip this slot.
      _preloadAd();
      return false;
    }

    _preloadedAd = null;
    if (_debugShowAd != null) {
      _debugShowAd!(ad);
    } else {
      ad.fullScreenContentCallback = FullScreenContentCallback(
        onAdDismissedFullScreenContent: (ad) {
          ad.dispose();
          _preloadAd();
        },
        onAdFailedToShowFullScreenContent: (ad, _) {
          ad.dispose();
          _preloadAd();
        },
      );
      ad.show();
    }
    return true;
  }

  /// Eagerly loads the next interstitial. Safe to call repeatedly; in-flight
  /// loads are deduplicated.
  Future<void> _preloadAd() async {
    if (_loadInFlight || _preloadedAd != null) return;
    _loadInFlight = true;
    try {
      await _loader(
        adUnitId: _config.interstitialAdUnitId,
        request: const AdRequest(),
        adLoadCallback: InterstitialAdLoadCallback(
          onAdLoaded: (ad) {
            _preloadedAd = ad;
            _loadInFlight = false;
          },
          onAdFailedToLoad: (_) {
            _loadInFlight = false;
          },
        ),
      );
    } catch (_) {
      _loadInFlight = false;
    }
  }

  /// Manually inject a preloaded ad. Tests use this to simulate "ad cached".
  @visibleForTesting
  void debugSetPreloadedAd(InterstitialAd? ad) {
    _preloadedAd = ad;
  }

  /// Disposes any cached ad and clears counters.
  void dispose() {
    _preloadedAd?.dispose();
    _preloadedAd = null;
    _eventCount = 0;
  }
}

/// Riverpod provider for a process-wide [InterstitialAdController]. Consumers
/// read this from their forecast view and call `showIfDue` on navigation.
final interstitialAdControllerProvider = Provider<InterstitialAdController>(
  (ref) {
    final controller = InterstitialAdController();
    ref.onDispose(controller.dispose);
    return controller;
  },
);
