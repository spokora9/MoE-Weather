import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:moe_weather/features/widgets/weather_widget_canvas.dart';
import 'package:moe_weather/features/widgets/widget_data.dart';

void main() {
  final _snapshot = WidgetSnapshot(
    temperature: 22.5,
    feelsLike: 20.0,
    description: 'Mostly sunny',
    weatherCode: 1,
    locationName: 'London',
    humidity: 60.0,
    windSpeed: 15.0,
    highTemp: 25.0,
    lowTemp: 14.0,
    lastUpdated: DateTime(2026, 5, 17, 12, 0),
    unitLabel: '°C',
  );

  group('WidgetSnapshot', () {
    test('required fields are stored', () {
      expect(_snapshot.temperature, 22.5);
      expect(_snapshot.feelsLike, 20.0);
      expect(_snapshot.description, 'Mostly sunny');
      expect(_snapshot.weatherCode, 1);
      expect(_snapshot.locationName, 'London');
      expect(_snapshot.humidity, 60.0);
      expect(_snapshot.windSpeed, 15.0);
      expect(_snapshot.highTemp, 25.0);
      expect(_snapshot.lowTemp, 14.0);
      expect(_snapshot.unitLabel, '°C');
    });

    test('unitLabel defaults to °C', () {
      final s = WidgetSnapshot(
        temperature: 18.0,
        feelsLike: 16.0,
        description: 'Cloudy',
        weatherCode: 3,
        locationName: 'Paris',
        humidity: 75.0,
        windSpeed: 10.0,
        lastUpdated: DateTime(2026, 5, 17),
      );
      expect(s.unitLabel, '°C');
      expect(s.highTemp, isNull);
      expect(s.lowTemp, isNull);
    });
  });

  group('WeatherWidgetCanvas', () {
    testWidgets('small canvas renders without error', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SizedBox(
            width: 160,
            height: 160,
            child: WeatherWidgetCanvas(
              snapshot: _snapshot,
              renderSize: WidgetRenderSize.small,
            ),
          ),
        ),
      );
      expect(find.byType(WeatherWidgetCanvas), findsOneWidget);
    });

    testWidgets('medium canvas renders without error', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SizedBox(
            width: 329,
            height: 155,
            child: WeatherWidgetCanvas(
              snapshot: _snapshot,
              renderSize: WidgetRenderSize.medium,
            ),
          ),
        ),
      );
      expect(find.byType(WeatherWidgetCanvas), findsOneWidget);
    });

    testWidgets('shows location name', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SizedBox(
            width: 329,
            height: 155,
            child: WeatherWidgetCanvas(snapshot: _snapshot),
          ),
        ),
      );
      expect(find.text('London'), findsOneWidget);
    });
  });
}
