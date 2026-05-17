import 'package:flutter_test/flutter_test.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:mocktail/mocktail.dart';

import 'package:moe_weather/features/ads/ads_service.dart';

class _MockInterstitialAd extends Mock implements InterstitialAd {}

class _ShownAd {
  _ShownAd(this.ad);
  final InterstitialAd ad;
}

void main() {
  late InterstitialAdController controller;
  late List<_ShownAd> shown;
  late int loadCalls;

  setUpAll(() {
    registerFallbackValue(const AdRequest());
  });

  setUp(() {
    shown = <_ShownAd>[];
    loadCalls = 0;

    controller = InterstitialAdController(
      showEvery: 5,
      loader: ({
        required adUnitId,
        required request,
        required adLoadCallback,
      }) async {
        loadCalls += 1;
        // Synthesise a successful load with a mock ad.
        final ad = _MockInterstitialAd();
        adLoadCallback.onAdLoaded(ad);
      },
      debugShowAd: (ad) => shown.add(_ShownAd(ad)),
    );
  });

  tearDown(() => controller.dispose());

  test('showIfDue does NOT trigger on the 1st through 4th calls', () {
    // Preload an ad so the only thing preventing display is the counter.
    final preloaded = _MockInterstitialAd();
    controller.debugSetPreloadedAd(preloaded);

    for (var i = 1; i <= 4; i++) {
      final fired = controller.showIfDue(isPro: false);
      expect(fired, isFalse, reason: 'call $i should not fire');
    }
    expect(shown, isEmpty);
    expect(controller.eventCount, 4);
  });

  test('showIfDue triggers exactly on the 5th call', () {
    final preloaded = _MockInterstitialAd();
    controller.debugSetPreloadedAd(preloaded);

    var fired = false;
    for (var i = 1; i <= 5; i++) {
      fired = controller.showIfDue(isPro: false);
    }
    expect(fired, isTrue);
    expect(shown, hasLength(1));
    expect(shown.single.ad, same(preloaded));
    expect(controller.eventCount, 5);
  });

  test('showIfDue never triggers when isPro=true (even after many calls)', () {
    final preloaded = _MockInterstitialAd();
    controller.debugSetPreloadedAd(preloaded);

    for (var i = 1; i <= 20; i++) {
      final fired = controller.showIfDue(isPro: true);
      expect(fired, isFalse);
    }
    expect(shown, isEmpty);
    // Counter should also stay at zero - pro users don't consume budget.
    expect(controller.eventCount, 0);
    // Still has the preloaded ad cached.
    expect(controller.hasPreloadedAd, isTrue);
  });

  test(
    'showIfDue with no initial ad still serves on the 5th call '
    '(preload runs at (N-1)th slot)',
    () async {
      // No preloaded ad set; loader synthesises one when asked.
      expect(controller.hasPreloadedAd, isFalse);

      // Calls 1-3: nothing happens, no load yet.
      for (var i = 1; i <= 3; i++) {
        expect(controller.showIfDue(isPro: false), isFalse);
      }
      expect(loadCalls, 0);

      // 4th call triggers a background preload.
      expect(controller.showIfDue(isPro: false), isFalse);
      await Future<void>.delayed(Duration.zero);
      expect(loadCalls, 1);
      expect(controller.hasPreloadedAd, isTrue);

      // 5th call fires the preloaded ad.
      expect(controller.showIfDue(isPro: false), isTrue);
      expect(shown, hasLength(1));
    },
  );
}
