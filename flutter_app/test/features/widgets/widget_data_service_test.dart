import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:moe_weather/features/widgets/weather_widget_canvas.dart';
import 'package:moe_weather/features/widgets/widget_data.dart';

final _now = DateTime(2026, 5, 18, 14, 0);

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
  lastUpdated: _now,
  unitLabel: '°C',
  sunrise: DateTime(2026, 5, 18, 6, 4),
  sunset: DateTime(2026, 5, 18, 20, 47),
  alertText: 'Severe Thunderstorm Warning',
  alertEnd: DateTime(2026, 5, 18, 20, 0),
  hourly: List.generate(
    7,
    (i) => HourlyWidgetEntry(
      time: _now.add(Duration(hours: i + 1)),
      temperature: 22.0 + i.toDouble(),
      feelsLike: 20.0 + i.toDouble(),
      weatherCode: i < 3 ? 0 : 3,
    ),
  ),
);

Widget _wrap(Widget child) => MaterialApp(home: child);

void main() {
  group('WidgetSnapshot', () {
    test('required fields stored', () {
      expect(_snapshot.temperature, 22.5);
      expect(_snapshot.feelsLike, 20.0);
      expect(_snapshot.unitLabel, '°C');
      expect(_snapshot.hourly.length, 7);
      expect(_snapshot.sunrise, isNotNull);
      expect(_snapshot.alertText, 'Severe Thunderstorm Warning');
    });

    test('optional fields default correctly', () {
      const s = WidgetSnapshot(
        temperature: 18.0,
        feelsLike: 16.0,
        description: 'Cloudy',
        weatherCode: 3,
        locationName: 'Paris',
        humidity: 75.0,
        windSpeed: 10.0,
        lastUpdated: _now,
      );
      expect(s.unitLabel, '°C');
      expect(s.highTemp, isNull);
      expect(s.hourly, isEmpty);
      expect(s.alertText, isNull);
      expect(s.sunrise, isNull);
    });
  });

  group('WeatherWidgetCanvas — small', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(_wrap(SizedBox(
        width: 160, height: 160,
        child: WeatherWidgetCanvas(snapshot: _snapshot, renderSize: WidgetRenderSize.small),
      )));
      expect(find.byType(WeatherWidgetCanvas), findsOneWidget);
    });

    testWidgets('shows location name', (tester) async {
      await tester.pumpWidget(_wrap(SizedBox(
        width: 160, height: 160,
        child: WeatherWidgetCanvas(snapshot: _snapshot, renderSize: WidgetRenderSize.small),
      )));
      expect(find.text('London'), findsOneWidget);
    });
  });

  group('WeatherWidgetCanvas — medium', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(_wrap(SizedBox(
        width: 329, height: 155,
        child: WeatherWidgetCanvas(snapshot: _snapshot, renderSize: WidgetRenderSize.medium),
      )));
      expect(find.byType(WeatherWidgetCanvas), findsOneWidget);
    });

    testWidgets('shows alert band when alertText is set', (tester) async {
      await tester.pumpWidget(_wrap(SizedBox(
        width: 329, height: 155,
        child: WeatherWidgetCanvas(snapshot: _snapshot, renderSize: WidgetRenderSize.medium),
      )));
      expect(find.textContaining('Thunderstorm'), findsOneWidget);
    });

    testWidgets('no alert band when alertText is null', (tester) async {
      const noAlert = WidgetSnapshot(
        temperature: 20, feelsLike: 18, description: 'Clear', weatherCode: 0,
        locationName: 'Oslo', humidity: 50, windSpeed: 5, lastUpdated: _now,
      );
      await tester.pumpWidget(_wrap(SizedBox(
        width: 329, height: 155,
        child: WeatherWidgetCanvas(snapshot: noAlert, renderSize: WidgetRenderSize.medium),
      )));
      expect(find.byType(Icons), findsNothing);
    });
  });

  group('WeatherWidgetCanvas — large', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(_wrap(SizedBox(
        width: 329, height: 345,
        child: WeatherWidgetCanvas(snapshot: _snapshot, renderSize: WidgetRenderSize.large),
      )));
      expect(find.byType(WeatherWidgetCanvas), findsOneWidget);
    });
  });
}
