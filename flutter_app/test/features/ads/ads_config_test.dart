import 'package:flutter_test/flutter_test.dart';

import 'package:moe_weather/features/ads/ads_config.dart';

void main() {
  group('AdsConfig (defaults to Google test IDs)', () {
    test('returns Android banner test ID on Android', () {
      final cfg = AdsConfig(isAndroidOverride: true, isIosOverride: false);
      expect(cfg.bannerAdUnitId, TestAdUnitIds.bannerAndroid);
      expect(cfg.interstitialAdUnitId, TestAdUnitIds.interstitialAndroid);
      expect(cfg.appId, TestAdUnitIds.appIdAndroid);
      expect(cfg.usingTestIds, isTrue);
    });

    test('returns iOS banner test ID on iOS', () {
      final cfg = AdsConfig(isIosOverride: true, isAndroidOverride: false);
      expect(cfg.bannerAdUnitId, TestAdUnitIds.bannerIos);
      expect(cfg.interstitialAdUnitId, TestAdUnitIds.interstitialIos);
      expect(cfg.appId, TestAdUnitIds.appIdIos);
      expect(cfg.usingTestIds, isTrue);
    });
  });
}
