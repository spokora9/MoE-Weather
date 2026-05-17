import 'package:flutter_test/flutter_test.dart';
import 'package:moe_weather/features/widgets/widget_data.dart';

void main() {
  group('WidgetSnapshot', () {
    test('can be constructed with required fields', () {
      final now = DateTime(2026, 5, 17, 12, 0);
      final snapshot = WidgetSnapshot(
        temperature: 22.5,
        feelsLike: 20.0,
        description: 'Mostly sunny',
        weatherCode: 1,
        locationName: 'London',
        humidity: 60.0,
        windSpeed: 15.0,
        highTemp: 25.0,
        lowTemp: 14.0,
        lastUpdated: now,
        unitLabel: '°C',
      );

      expect(snapshot.temperature, 22.5);
      expect(snapshot.feelsLike, 20.0);
      expect(snapshot.description, 'Mostly sunny');
      expect(snapshot.weatherCode, 1);
      expect(snapshot.locationName, 'London');
      expect(snapshot.humidity, 60.0);
      expect(snapshot.windSpeed, 15.0);
      expect(snapshot.highTemp, 25.0);
      expect(snapshot.lowTemp, 14.0);
      expect(snapshot.lastUpdated, now);
      expect(snapshot.unitLabel, '°C');
    });

    test('unitLabel defaults to °C when not supplied', () {
      final snapshot = WidgetSnapshot(
        temperature: 18.0,
        feelsLike: 16.0,
        description: 'Cloudy',
        weatherCode: 3,
        locationName: 'Paris',
        humidity: 75.0,
        windSpeed: 10.0,
        lastUpdated: DateTime(2026, 5, 17),
      );

      expect(snapshot.unitLabel, '°C');
      expect(snapshot.highTemp, isNull);
      expect(snapshot.lowTemp, isNull);
    });
  });

  group('WidgetDataKeys', () {
    test('all constants are non-empty strings', () {
      final keys = [
        WidgetDataKeys.temperature,
        WidgetDataKeys.feelsLike,
        WidgetDataKeys.description,
        WidgetDataKeys.weatherCode,
        WidgetDataKeys.locationName,
        WidgetDataKeys.humidity,
        WidgetDataKeys.windSpeed,
        WidgetDataKeys.highTemp,
        WidgetDataKeys.lowTemp,
        WidgetDataKeys.lastUpdated,
        WidgetDataKeys.unitLabel,
      ];

      for (final key in keys) {
        expect(key, isNotEmpty, reason: 'Key "$key" must not be empty');
      }
    });
  });
}
