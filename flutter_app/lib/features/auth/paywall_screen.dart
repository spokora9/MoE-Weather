import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import 'revenuecat_service.dart';

/// Future provider that fetches the current Offering from RevenueCat.
final paywallOfferingProvider = FutureProvider<Offering?>((ref) async {
  final service = ref.watch(revenueCatServiceProvider);
  return service.getOfferings();
});

const List<String> _proFeatures = <String>[
  'Hour-by-hour hyperlocal forecasts',
  'Marine, tide, and surf insights',
  'Severe weather alerts with push notifications',
  'Ad-free experience',
  'Unlimited saved locations',
];

/// Paywall: header, feature list, monthly + annual cards, CTA, restore link,
/// and a Terms / Privacy footer.
class PaywallScreen extends ConsumerWidget {
  const PaywallScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offeringAsync = ref.watch(paywallOfferingProvider);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Go Pro')),
      body: SafeArea(
        child: offeringAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('Could not load subscriptions: $err'),
            ),
          ),
          data: (offering) {
            if (offering == null) {
              return const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('No subscription offerings are available yet.'),
                ),
              );
            }
            return ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  'Unlock MoE Weather Pro',
                  style: theme.textTheme.headlineMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  'Everything you need to stay ahead of the weather.',
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: 20),
                ..._proFeatures.map(
                  (feature) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        const Icon(Icons.check_circle, size: 20),
                        const SizedBox(width: 8),
                        Expanded(child: Text(feature)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                if (offering.monthly != null)
                  _PriceCard(
                    key: const Key('paywall_monthly_card'),
                    title: 'Monthly',
                    package: offering.monthly!,
                  ),
                const SizedBox(height: 12),
                if (offering.annual != null)
                  _PriceCard(
                    key: const Key('paywall_annual_card'),
                    title: 'Annual',
                    package: offering.annual!,
                    badge: 'Best value',
                  ),
                const SizedBox(height: 24),
                TextButton(
                  key: const Key('paywall_restore_button'),
                  onPressed: () async {
                    final service = ref.read(revenueCatServiceProvider);
                    try {
                      final info = await service.restorePurchases();
                      ref.read(customerInfoProvider.notifier).value = info;
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Purchases restored')),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Restore failed: $e')),
                        );
                      }
                    }
                  },
                  child: const Text('Restore Purchases'),
                ),
                const SizedBox(height: 12),
                Center(
                  child: Text(
                    'By subscribing you agree to our Terms and Privacy Policy.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall,
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _PriceCard extends ConsumerWidget {
  const _PriceCard({
    super.key,
    required this.title,
    required this.package,
    this.badge,
  });

  final String title;
  final Package package;
  final String? badge;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(title, style: theme.textTheme.titleMedium),
                      if (badge != null) ...[
                        const SizedBox(width: 8),
                        Chip(label: Text(badge!)),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    package.storeProduct.priceString,
                    style: theme.textTheme.bodyLarge,
                  ),
                ],
              ),
            ),
            FilledButton(
              key: Key('paywall_cta_${title.toLowerCase()}'),
              onPressed: () async {
                final service = ref.read(revenueCatServiceProvider);
                try {
                  final info = await service.purchasePackage(package);
                  ref.read(customerInfoProvider.notifier).value = info;
                  if (context.mounted) {
                    Navigator.of(context).maybePop();
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Purchase failed: $e')),
                    );
                  }
                }
              },
              child: const Text('Subscribe'),
            ),
          ],
        ),
      ),
    );
  }
}
