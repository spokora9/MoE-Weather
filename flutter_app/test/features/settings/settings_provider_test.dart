import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:moe_weather/features/settings/settings_model.dart';
import 'package:moe_weather/features/settings/settings_provider.dart';
import 'package:moe_weather/features/settings/settings_repository.dart';

class _MockSettingsRepository extends Mock implements SettingsRepository {}

void main() {
  late _MockSettingsRepository mockRepo;

  setUp(() {
    mockRepo = _MockSettingsRepository();
  });

  ProviderContainer _makeContainer() {
    return ProviderContainer(
      overrides: [
        settingsRepositoryProvider.overrideWithValue(mockRepo),
      ],
    );
  }

  group('SettingsNotifier', () {
    test('build calls repository.load and returns settings', () async {
      const defaultSettings = AppSettings();
      when(() => mockRepo.load()).thenAnswer((_) async => defaultSettings);

      final container = _makeContainer();
      addTearDown(container.dispose);

      // Trigger the build
      final state = await container.read(settingsProvider.future);
      expect(state, equals(defaultSettings));
      verify(() => mockRepo.load()).called(1);
    });

    test('update saves settings and updates state', () async {
      const initial = AppSettings();
      const updated = AppSettings(
        temperatureUnit: TemperatureUnit.fahrenheit,
        windSpeedUnit: WindSpeedUnit.mph,
        use24HourClock: false,
        showAlerts: false,
      );

      when(() => mockRepo.load()).thenAnswer((_) async => initial);
      when(() => mockRepo.save(any())).thenAnswer((_) async {});

      final container = _makeContainer();
      addTearDown(container.dispose);

      // Wait for initial load
      await container.read(settingsProvider.future);

      // Perform update
      await container.read(settingsProvider.notifier).update(updated);

      verify(() => mockRepo.save(updated)).called(1);
      expect(container.read(settingsProvider), equals(const AsyncData(updated)));
    });
  });
}
