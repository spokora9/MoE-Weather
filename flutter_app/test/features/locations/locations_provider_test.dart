import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:moe_weather/api/models/saved_location.dart';
import 'package:moe_weather/features/locations/locations_provider.dart';
import 'package:moe_weather/features/locations/locations_repository.dart';

class _MockLocationsRepository extends Mock implements LocationsRepository {}

// Helpers to build test fixtures without requiring all fields.
SavedLocation _makeLocation({
  required String id,
  String userId = 'u1',
  required String name,
  double latitude = 0.0,
  double longitude = 0.0,
  String? country,
  bool isDefault = false,
}) {
  return SavedLocation(
    id: id,
    userId: userId,
    name: name,
    latitude: latitude,
    longitude: longitude,
    country: country,
    isDefault: isDefault,
  );
}

void main() {
  late _MockLocationsRepository mockRepo;

  setUp(() {
    mockRepo = _MockLocationsRepository();
    // registerFallbackValue so any() works for SavedLocationInput
    registerFallbackValue(
      const SavedLocationInput(name: 'x', latitude: 0, longitude: 0),
    );
  });

  ProviderContainer _makeContainer() {
    return ProviderContainer(
      overrides: [
        locationsRepositoryProvider.overrideWithValue(mockRepo),
      ],
    );
  }

  group('LocationsNotifier', () {
    test('build loads locations', () async {
      final london = _makeLocation(id: 'loc1', name: 'London');
      when(() => mockRepo.getLocations()).thenAnswer((_) async => [london]);

      final container = _makeContainer();
      addTearDown(container.dispose);

      final locations = await container.read(locationsProvider.future);
      expect(locations, [london]);
      verify(() => mockRepo.getLocations()).called(1);
    });

    test('addLocation appends to existing list', () async {
      final london = _makeLocation(id: 'loc1', name: 'London');
      final paris = _makeLocation(id: 'loc2', name: 'Paris', country: 'France');

      when(() => mockRepo.getLocations()).thenAnswer((_) async => [london]);
      when(() => mockRepo.addLocation(any())).thenAnswer((_) async => paris);

      final container = _makeContainer();
      addTearDown(container.dispose);

      await container.read(locationsProvider.future);

      const input = SavedLocationInput(
        name: 'Paris',
        latitude: 48.85,
        longitude: 2.35,
        country: 'France',
      );
      await container.read(locationsProvider.notifier).addLocation(input);

      final state = container.read(locationsProvider);
      expect(state.value, hasLength(2));
      expect(state.value!.last.name, 'Paris');
    });

    test('deleteLocation removes from list', () async {
      final london = _makeLocation(id: 'loc1', name: 'London');
      final paris = _makeLocation(id: 'loc2', name: 'Paris');

      when(() => mockRepo.getLocations())
          .thenAnswer((_) async => [london, paris]);
      when(() => mockRepo.deleteLocation(any())).thenAnswer((_) async {});

      final container = _makeContainer();
      addTearDown(container.dispose);

      await container.read(locationsProvider.future);

      await container
          .read(locationsProvider.notifier)
          .deleteLocation('loc1');

      final state = container.read(locationsProvider);
      expect(state.value, hasLength(1));
      expect(state.value!.first.id, 'loc2');
    });

    test('setDefault updates the default location in state', () async {
      final london = _makeLocation(id: 'loc1', name: 'London', isDefault: true);
      final paris = _makeLocation(id: 'loc2', name: 'Paris', isDefault: false);
      final parisAsDefault =
          _makeLocation(id: 'loc2', name: 'Paris', isDefault: true);

      when(() => mockRepo.getLocations())
          .thenAnswer((_) async => [london, paris]);
      when(() => mockRepo.setDefault('loc2'))
          .thenAnswer((_) async => parisAsDefault);

      final container = _makeContainer();
      addTearDown(container.dispose);

      await container.read(locationsProvider.future);

      await container.read(locationsProvider.notifier).setDefault('loc2');

      final state = container.read(locationsProvider);
      final result = state.value!;
      expect(result, hasLength(2));

      final londonResult = result.firstWhere((l) => l.id == 'loc1');
      final parisResult = result.firstWhere((l) => l.id == 'loc2');

      expect(londonResult.isDefault, isFalse);
      expect(parisResult.isDefault, isTrue);
    });
  });
}
