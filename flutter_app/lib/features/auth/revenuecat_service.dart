import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import 'auth_state.dart';
import 'supabase_auth.dart';

/// Identifier of the "pro" entitlement configured in the RevenueCat dashboard.
const String kProEntitlementId = 'pro';

/// Thin wrapper around RevenueCat's `purchases_flutter` plugin. Exposes the
/// limited surface area we use: offerings, purchase, restore, identification,
/// and entitlement checks.
class RevenueCatService {
  RevenueCatService({PurchasesPlatformWrapper? purchases})
      : _purchases = purchases ?? const PurchasesPlatformWrapper();

  final PurchasesPlatformWrapper _purchases;

  /// Initialize the RevenueCat SDK. Must be called from `main()` before
  /// `runApp`. Keys come from `--dart-define`.
  static Future<void> initializeRevenueCat({
    required String apiKeyIos,
    required String apiKeyAndroid,
  }) async {
    if (kIsWeb) return; // RevenueCat does not support web targets.
    final String apiKey;
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
        apiKey = apiKeyIos;
        break;
      case TargetPlatform.android:
        apiKey = apiKeyAndroid;
        break;
      case TargetPlatform.fuchsia:
      case TargetPlatform.linux:
      case TargetPlatform.windows:
        return; // Unsupported platform: skip silently.
    }
    if (apiKey.isEmpty) return;
    final config = PurchasesConfiguration(apiKey);
    await Purchases.configure(config);
  }

  /// Returns the current offering, or null if none is configured.
  Future<Offering?> getOfferings() async {
    final offerings = await _purchases.getOfferings();
    return offerings.current;
  }

  /// Purchase a [Package] and return the resulting [CustomerInfo].
  Future<CustomerInfo> purchasePackage(Package package) {
    return _purchases.purchasePackage(package);
  }

  /// Restore previously made purchases.
  Future<CustomerInfo> restorePurchases() => _purchases.restorePurchases();

  /// Identify the current user with RevenueCat so entitlements follow them
  /// across devices. Called whenever Supabase auth changes.
  Future<CustomerInfo> logIn(String userId) => _purchases.logIn(userId);

  /// Reset RevenueCat's identification, used when the Supabase user signs out.
  Future<CustomerInfo> logOut() => _purchases.logOut();

  /// Fetch the current customer info.
  Future<CustomerInfo> getCustomerInfo() => _purchases.getCustomerInfo();

  /// True if the "pro" entitlement is active on the supplied [info].
  static bool isProEntitlementActive(CustomerInfo info) {
    final entitlement = info.entitlements.active[kProEntitlementId];
    return entitlement != null && entitlement.isActive;
  }
}

/// Indirection layer over the `Purchases` static API so tests can substitute a
/// `mocktail` mock without invoking native code.
class PurchasesPlatformWrapper {
  const PurchasesPlatformWrapper();

  Future<Offerings> getOfferings() => Purchases.getOfferings();

  Future<CustomerInfo> purchasePackage(Package package) async {
    final result = await Purchases.purchase(PurchaseParams.package(package));
    return result.customerInfo;
  }

  Future<CustomerInfo> restorePurchases() => Purchases.restorePurchases();

  Future<CustomerInfo> logIn(String userId) async {
    final result = await Purchases.logIn(userId);
    return result.customerInfo;
  }

  Future<CustomerInfo> logOut() => Purchases.logOut();

  Future<CustomerInfo> getCustomerInfo() => Purchases.getCustomerInfo();
}

/// Default service provider. Tests override this with a mock RevenueCat.
final revenueCatServiceProvider = Provider<RevenueCatService>((ref) {
  return RevenueCatService();
});

/// Notifier exposing the latest known [CustomerInfo]. Replaces the legacy
/// `StateProvider` API which is deprecated in `flutter_riverpod` 3.x.
class CustomerInfoNotifier extends Notifier<CustomerInfo?> {
  @override
  CustomerInfo? build() => null;

  set value(CustomerInfo? info) => state = info;
}

/// Latest known [CustomerInfo]. Updated by the RevenueCat customer info stream
/// (initialized from the orchestrator), or refreshed manually after purchase.
final customerInfoProvider =
    NotifierProvider<CustomerInfoNotifier, CustomerInfo?>(
  CustomerInfoNotifier.new,
);

/// Resolves the current [SubscriptionTier] by combining Supabase auth status
/// and the latest RevenueCat customer info.
///
/// - No signed-in user                                  -> anonymous
/// - Signed-in user, no/expired "pro" entitlement       -> free
/// - Signed-in user with active "pro" entitlement       -> pro
final tierProvider = Provider<SubscriptionTier>((ref) {
  final user = ref.watch(supabaseUserProvider).maybeWhen(
        data: (u) => u,
        orElse: () => null,
      );
  if (user == null) return SubscriptionTier.anonymous;
  final info = ref.watch(customerInfoProvider);
  if (info != null && RevenueCatService.isProEntitlementActive(info)) {
    return SubscriptionTier.pro;
  }
  return SubscriptionTier.free;
});

/// Bridge: listen to Supabase auth changes and forward them to RevenueCat so
/// the SDK knows which user to attribute purchases to. Read this provider at
/// app startup (e.g., from a `Consumer` near the root) to activate the bridge.
final revenueCatAuthBridgeProvider = Provider<void>((ref) {
  final service = ref.watch(revenueCatServiceProvider);
  ref.listen<AsyncValue<AuthUser?>>(supabaseUserProvider, (prev, next) {
    next.whenData((user) async {
      try {
        if (user == null) {
          await service.logOut();
        } else {
          await service.logIn(user.id);
        }
        final info = await service.getCustomerInfo();
        ref.read(customerInfoProvider.notifier).value = info;
      } catch (_) {
        // Surface upstream via logging; keep the bridge alive on failure.
      }
    });
  });
});
