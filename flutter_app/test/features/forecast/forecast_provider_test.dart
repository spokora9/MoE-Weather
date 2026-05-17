import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:moe_weather/api/models/weather_response.dart';
import 'package:moe_weather/features/forecast/forecast_provider.dart';
import 'package:moe_weather/features/forecast/weather_repository.dart';

class MockWeatherRepository extends Mock implements WeatherRepository {}

// Minimal valid WeatherResponse for use in tests
WeatherResponse _fakeResponse() => const WeatherResponse(
      location: WeatherLocation(
        name: 'Test City',
        country: 'TC',
        coordinates: WeatherCoordinates(latitude: 10.0, longitude: 20.0),
      ),
    );

void main() {
  late MockWeatherRepository mockRepo;
  late ProviderContainer container;

  setUp(() {
    mockRepo = MockWeatherRepository();
    container = ProviderContainer(
      overrides: [
        weatherRepositoryProvider.overrideWithValue(mockRepo),
      ],
    );
    registerFallbackValue(0.0);
  });

  tearDown(() => container.dispose());

  test('initial state is AsyncData(null)', () {
    final state = container.read(forecastProvider);
    expect(state, const AsyncData<WeatherResponse?>(null));
  });

  test('load transitions through AsyncLoading to AsyncData', () async {
    when(() => mockRepo.getWeather(any(), any()))
        .thenAnswer((_) async => _fakeResponse());

    final notifier = container.read(forecastProvider.notifier);

    // Start the load and capture states
    final future = notifier.load((lat: 10.0, lon: 20.0));

    // After initiating, state should be loading
    expect(container.read(forecastProvider), isA<AsyncLoading<WeatherResponse?>>());

    await future;

    final state = container.read(forecastProvider);
    expect(state, isA<AsyncData<WeatherResponse?>>());
    expect(state.value?.location.name, 'Test City');
  });

  test('load sets AsyncError on repository failure', () async {
    when(() => mockRepo.getWeather(any(), any()))
        .thenThrow(Exception('network failure'));

    await container.read(forecastProvider.notifier).load((lat: 0.0, lon: 0.0));

    final state = container.read(forecastProvider);
    expect(state, isA<AsyncError<WeatherResponse?>>());
  });

  test('refresh is no-op when params is null', () async {
    // No load called, so _params is null — refresh should return silently
    await container.read(forecastProvider.notifier).refresh();
    // State remains initial
    expect(container.read(forecastProvider), const AsyncData<WeatherResponse?>(null));
    verifyNever(() => mockRepo.getWeather(any(), any()));
  });

  test('refresh calls load again with stored params', () async {
    when(() => mockRepo.getWeather(any(), any()))
        .thenAnswer((_) async => _fakeResponse());

    final notifier = container.read(forecastProvider.notifier);
    await notifier.load((lat: 51.5, lon: -0.12));

    // Reset call count to verify refresh triggers a second call
    clearInteractions(mockRepo);
    when(() => mockRepo.getWeather(any(), any()))
        .thenAnswer((_) async => _fakeResponse());

    await notifier.refresh();

    verify(() => mockRepo.getWeather(51.5, -0.12)).called(1);
  });
}
