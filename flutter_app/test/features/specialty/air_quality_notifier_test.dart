import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:moe_weather/api/api_exception.dart';
import 'package:moe_weather/api/models/api_error.dart';
import 'package:moe_weather/features/specialty/air_quality_model.dart';
import 'package:moe_weather/features/specialty/specialty_providers.dart';
import 'package:moe_weather/features/specialty/specialty_repository.dart';

class _MockSpecialtyRepository extends Mock implements SpecialtyRepository {}

final _stubAq = AirQualityResponse(
  aqi: 42,
  category: 'Good',
  pm25: 10.5,
  pm10: 20.0,
  o3: 33.1,
  no2: 5.2,
  co: 0.4,
  so2: 1.1,
  timestamp: DateTime.utc(2026, 5, 17, 12),
);

void main() {
  group('AirQualityNotifier', () {
    late _MockSpecialtyRepository mockRepo;

    setUp(() {
      mockRepo = _MockSpecialtyRepository();
    });

    ProviderContainer _makeContainer() {
      final container = ProviderContainer(
        overrides: [
          specialtyRepositoryProvider.overrideWithValue(mockRepo),
        ],
      );
      addTearDown(container.dispose);
      return container;
    }

    test('initial state is AsyncData(null)', () {
      final container = _makeContainer();
      final state = container.read(airQualityProvider);
      expect(state, const AsyncData<dynamic>(null));
    });

    test('load transitions to AsyncData on success', () async {
      when(() => mockRepo.getAirQuality(51.5, -0.12))
          .thenAnswer((_) async => _stubAq);

      final container = _makeContainer();
      await container.read(airQualityProvider.notifier).load(51.5, -0.12);

      final state = container.read(airQualityProvider);
      expect(state, isA<AsyncData<dynamic>>());
      expect(state.value, _stubAq);
    });

    test('load transitions to AsyncError on failure', () async {
      when(() => mockRepo.getAirQuality(51.5, -0.12)).thenThrow(
        ApiException(
          error: const ApiError(error: 'server_error'),
          statusCode: 500,
        ),
      );

      final container = _makeContainer();
      await container.read(airQualityProvider.notifier).load(51.5, -0.12);

      final state = container.read(airQualityProvider);
      expect(state, isA<AsyncError<dynamic>>());
    });

    test('refresh is no-op when params null', () async {
      final container = _makeContainer();
      await container.read(airQualityProvider.notifier).refresh();

      verifyNever(() => mockRepo.getAirQuality(any(), any()));
    });
  });
}
