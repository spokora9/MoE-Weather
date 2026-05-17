import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:moe_weather/features/auth/auth_state.dart';
import 'package:moe_weather/features/auth/revenuecat_service.dart';
import 'package:moe_weather/features/auth/supabase_auth.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

class _MockCustomerInfo extends Mock implements CustomerInfo {}

class _MockEntitlementInfos extends Mock implements EntitlementInfos {}

class _MockEntitlementInfo extends Mock implements EntitlementInfo {}

class _FakeCustomerInfoNotifier extends CustomerInfoNotifier {
  _FakeCustomerInfoNotifier(this._initial);

  final CustomerInfo? _initial;

  @override
  CustomerInfo? build() => _initial;
}

CustomerInfo _buildCustomerInfo({required bool proActive}) {
  final entitlement = _MockEntitlementInfo();
  when(() => entitlement.isActive).thenReturn(proActive);

  final entitlements = _MockEntitlementInfos();
  when(() => entitlements.active).thenReturn(
    proActive ? {kProEntitlementId: entitlement} : <String, EntitlementInfo>{},
  );

  final info = _MockCustomerInfo();
  when(() => info.entitlements).thenReturn(entitlements);
  return info;
}

void main() {
  group('tierProvider', () {
    test('returns anonymous when no Supabase user is present', () {
      final container = ProviderContainer(
        overrides: [
          supabaseUserProvider.overrideWith((ref) => Stream.value(null)),
        ],
      );
      addTearDown(container.dispose);

      // Force the StreamProvider to emit before we read tierProvider.
      container.read(supabaseUserProvider);
      expect(container.read(tierProvider), SubscriptionTier.anonymous);
    });

    test(
      'returns free when a user is signed in but has no active "pro" entitlement',
      () async {
        final container = ProviderContainer(
          overrides: [
            supabaseUserProvider.overrideWith(
              (ref) => Stream.value(
                const AuthUser(id: 'u-1', email: 'a@b.co'),
              ),
            ),
          ],
        );
        addTearDown(container.dispose);

        // Wait for the stream's first value.
        await container.read(supabaseUserProvider.future);
        // Default customerInfoProvider is null -> free.
        expect(container.read(tierProvider), SubscriptionTier.free);
      },
    );

    test(
      'returns pro when the user is signed in and the "pro" entitlement is active',
      () async {
        final info = _buildCustomerInfo(proActive: true);
        final container = ProviderContainer(
          overrides: [
            supabaseUserProvider.overrideWith(
              (ref) => Stream.value(
                const AuthUser(id: 'u-1', email: 'a@b.co'),
              ),
            ),
            customerInfoProvider.overrideWith(() => _FakeCustomerInfoNotifier(info)),
          ],
        );
        addTearDown(container.dispose);

        await container.read(supabaseUserProvider.future);
        expect(container.read(tierProvider), SubscriptionTier.pro);
      },
    );

    test(
      'isProEntitlementActive returns false when "pro" entitlement is missing',
      () {
        final info = _buildCustomerInfo(proActive: false);
        expect(RevenueCatService.isProEntitlementActive(info), isFalse);
      },
    );

    test(
      'isProEntitlementActive returns true when "pro" entitlement is active',
      () {
        final info = _buildCustomerInfo(proActive: true);
        expect(RevenueCatService.isProEntitlementActive(info), isTrue);
      },
    );
  });
}
