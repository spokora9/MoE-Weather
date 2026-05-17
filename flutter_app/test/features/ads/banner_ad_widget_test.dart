import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:moe_weather/features/ads/ads_service.dart';
import 'package:moe_weather/features/ads/ads_tier_provider.dart';

void main() {
  setUp(resetIsProResolverForTesting);
  tearDown(resetIsProResolverForTesting);

  testWidgets(
    'BannerAdWidget returns SizedBox.shrink() when isPro=true',
    (tester) async {
      setIsProResolver((_) => true);

      await tester.pumpWidget(
        const ProviderScope(
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: BannerAdWidget(debugSkipAdLoad: true),
          ),
        ),
      );

      // Should render exactly one SizedBox (the shrink), with zero size.
      final bannerFinder = find.byType(BannerAdWidget);
      expect(bannerFinder, findsOneWidget);

      final shrink = tester.widget<SizedBox>(
        find.descendant(
          of: bannerFinder,
          matching: find.byType(SizedBox),
        ),
      );
      expect(shrink.width, 0.0);
      expect(shrink.height, 0.0);

      // The placeholder key must NOT be present for pro users.
      expect(find.byKey(const ValueKey('banner_ad_placeholder')), findsNothing);
    },
  );

  testWidgets(
    'BannerAdWidget returns a banner placeholder when isPro=false',
    (tester) async {
      // Default resolver is "always free", but be explicit for clarity.
      setIsProResolver((_) => false);

      await tester.pumpWidget(
        const ProviderScope(
          child: Directionality(
            textDirection: TextDirection.ltr,
            child: SizedBox(
              width: 320,
              child: BannerAdWidget(
                debugSkipAdLoad: true,
                placeholderHeight: 50,
              ),
            ),
          ),
        ),
      );

      final placeholder = find.byKey(const ValueKey('banner_ad_placeholder'));
      expect(placeholder, findsOneWidget);

      final placeholderBox = tester.widget<SizedBox>(placeholder);
      expect(placeholderBox.height, 50.0);
    },
  );
}
