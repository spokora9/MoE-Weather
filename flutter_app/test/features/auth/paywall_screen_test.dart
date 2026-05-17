import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:moe_weather/features/auth/paywall_screen.dart';
import 'package:moe_weather/features/auth/revenuecat_service.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

class _MockRevenueCatService extends Mock implements RevenueCatService {}

class _MockOffering extends Mock implements Offering {}

class _MockPackage extends Mock implements Package {}

class _MockStoreProduct extends Mock implements StoreProduct {}

Package _buildPackage(String priceString) {
  final product = _MockStoreProduct();
  when(() => product.priceString).thenReturn(priceString);
  final package = _MockPackage();
  when(() => package.storeProduct).thenReturn(product);
  return package;
}

void main() {
  testWidgets(
    'PaywallScreen renders monthly and annual cards from a fake Offerings',
    (tester) async {
      final monthly = _buildPackage('\$4.99 / mo');
      final annual = _buildPackage('\$39.99 / yr');
      final offering = _MockOffering();
      when(() => offering.monthly).thenReturn(monthly);
      when(() => offering.annual).thenReturn(annual);

      final mockService = _MockRevenueCatService();
      when(mockService.getOfferings).thenAnswer((_) async => offering);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            revenueCatServiceProvider.overrideWithValue(mockService),
          ],
          child: const MaterialApp(home: PaywallScreen()),
        ),
      );

      // Allow the FutureProvider to resolve.
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('paywall_monthly_card')), findsOneWidget);
      expect(find.byKey(const Key('paywall_annual_card')), findsOneWidget);
      expect(find.text('\$4.99 / mo'), findsOneWidget);
      expect(find.text('\$39.99 / yr'), findsOneWidget);
      expect(find.byKey(const Key('paywall_restore_button')), findsOneWidget);
    },
  );

  testWidgets(
    'PaywallScreen shows a fallback message when no offering is available',
    (tester) async {
      final mockService = _MockRevenueCatService();
      when(mockService.getOfferings).thenAnswer((_) async => null);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            revenueCatServiceProvider.overrideWithValue(mockService),
          ],
          child: const MaterialApp(home: PaywallScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.text('No subscription offerings are available yet.'),
        findsOneWidget,
      );
    },
  );
}
