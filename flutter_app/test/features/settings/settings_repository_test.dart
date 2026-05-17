import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:moe_weather/features/settings/settings_model.dart';
import 'package:moe_weather/features/settings/settings_repository.dart';

void main() {
  late Directory tempDir;

  setUpAll(() async {
    tempDir = await Directory.systemTemp.createTemp('settings_hive_test');
    Hive.init(tempDir.path);
  });

  tearDownAll(() async {
    await Hive.close();
    await tempDir.delete(recursive: true);
  });

  tearDown(() async {
    await Hive.deleteBoxFromDisk('app_settings');
  });

  test('load returns defaults when box is empty', () async {
    final repo = SettingsRepository();
    final settings = await repo.load();
    expect(settings.temperatureUnit, TemperatureUnit.celsius);
    expect(settings.use24HourClock, isTrue);
  });

  test('save and load round-trips correctly', () async {
    final repo = SettingsRepository();
    const updated = AppSettings(
      temperatureUnit: TemperatureUnit.fahrenheit,
      windSpeedUnit: WindSpeedUnit.mph,
      use24HourClock: false,
      showAlerts: false,
    );
    await repo.save(updated);
    final loaded = await repo.load();
    expect(loaded.temperatureUnit, TemperatureUnit.fahrenheit);
    expect(loaded.windSpeedUnit, WindSpeedUnit.mph);
    expect(loaded.use24HourClock, isFalse);
  });
}
