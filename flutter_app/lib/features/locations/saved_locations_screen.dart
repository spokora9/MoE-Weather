import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:moe_weather/api/models/geocode_result.dart';
import 'package:moe_weather/api/models/saved_location.dart';
import 'package:moe_weather/features/auth/revenuecat_service.dart';
import 'location_search_screen.dart';
import 'locations_provider.dart';

class SavedLocationsScreen extends ConsumerWidget {
  const SavedLocationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locationsAsync = ref.watch(locationsProvider);
    final tier = ref.watch(tierProvider);

    return locationsAsync.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => Scaffold(
        appBar: AppBar(title: const Text('Saved Locations')),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Error: $error'),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => ref.invalidate(locationsProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (locations) => _SavedLocationsBody(
        locations: locations,
        tier: tier,
      ),
    );
  }
}

class _SavedLocationsBody extends ConsumerWidget {
  const _SavedLocationsBody({
    required this.locations,
    required this.tier,
  });

  final List<SavedLocation> locations;
  final SubscriptionTier tier;

  Future<void> _onFabPressed(BuildContext context, WidgetRef ref) async {
    final isFreeAtLimit =
        tier != SubscriptionTier.pro && locations.length >= 5;
    if (isFreeAtLimit) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Upgrade to Pro to add more locations'),
        ),
      );
      return;
    }

    final result = await Navigator.push<GeocodeResult>(
      context,
      MaterialPageRoute<GeocodeResult>(
        builder: (_) => const LocationSearchScreen(),
      ),
    );
    if (result == null) return;
    await ref.read(locationsProvider.notifier).addLocation(
          SavedLocationInput(
            name: result.name,
            latitude: result.latitude,
            longitude: result.longitude,
            country: result.country,
          ),
        );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    String id,
    String locationName,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove location?'),
        content: Text('Remove $locationName?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(locationsProvider.notifier).deleteLocation(id);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colorScheme = Theme.of(context).colorScheme;
    final showUpgradeTile =
        tier != SubscriptionTier.pro && locations.length >= 5;

    Widget body;
    if (locations.isEmpty) {
      body = const Center(
        child: Text('No saved locations. Tap + to add one.'),
      );
    } else {
      final itemCount = locations.length + (showUpgradeTile ? 1 : 0);
      body = ReorderableListView.builder(
        itemCount: itemCount,
        onReorder: (_, __) {}, // reorder API not implemented yet
        itemBuilder: (context, index) {
          if (showUpgradeTile && index == locations.length) {
            return ListTile(
              key: const ValueKey('upgrade_tile'),
              leading: const Icon(Icons.lock),
              title: const Text('Unlimited locations'),
              subtitle: const Text('Upgrade to Pro'),
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Upgrade to Pro to add more locations'),
                  ),
                );
              },
            );
          }

          final location = locations[index];
          return ListTile(
            key: ValueKey(location.id),
            leading: Hero(
              tag: 'location_${location.id}',
              child: IconButton(
                icon: Icon(
                  location.isDefault ? Icons.star : Icons.star_border,
                  color: location.isDefault ? colorScheme.primary : null,
                ),
                onPressed: () =>
                    ref.read(locationsProvider.notifier).setDefault(location.id),
              ),
            ),
            title: Text(location.name),
            subtitle: Text(location.country ?? ''),
            trailing: IconButton(
              icon: const Icon(Icons.delete_outline),
              onPressed: () =>
                  _confirmDelete(context, ref, location.id, location.name),
            ),
          );
        },
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Saved Locations')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _onFabPressed(context, ref),
        child: const Icon(Icons.add),
      ),
      body: body,
    );
  }
}
