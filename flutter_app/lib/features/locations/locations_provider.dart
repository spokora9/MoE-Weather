import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:moe_weather/api/models/saved_location.dart';
import 'locations_repository.dart';

class LocationsNotifier extends AsyncNotifier<List<SavedLocation>> {
  @override
  Future<List<SavedLocation>> build() =>
      ref.read(locationsRepositoryProvider).getLocations();

  Future<void> addLocation(SavedLocationInput input) async {
    final added =
        await ref.read(locationsRepositoryProvider).addLocation(input);
    final current = state.valueOrNull ?? [];
    state = AsyncData([...current, added]);
  }

  Future<void> deleteLocation(String id) async {
    await ref.read(locationsRepositoryProvider).deleteLocation(id);
    final current = state.valueOrNull ?? [];
    state = AsyncData(current.where((l) => l.id != id).toList());
  }

  Future<void> setDefault(String id) async {
    final updated =
        await ref.read(locationsRepositoryProvider).setDefault(id);
    final current = state.valueOrNull ?? [];
    state = AsyncData(current.map((l) {
      if (l.id == id) return updated;
      if (l.isDefault) {
        return SavedLocation(
          id: l.id,
          userId: l.userId,
          name: l.name,
          latitude: l.latitude,
          longitude: l.longitude,
          country: l.country,
          isDefault: false,
          displayOrder: l.displayOrder,
          createdAt: l.createdAt,
        );
      }
      return l;
    }).toList());
  }
}

final locationsProvider =
    AsyncNotifierProvider<LocationsNotifier, List<SavedLocation>>(
        LocationsNotifier.new);
