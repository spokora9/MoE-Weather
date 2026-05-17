import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:moe_weather/features/forecast/weather_animation.dart';

void main() {
  Widget _wrap(Widget child) {
    return MaterialApp(home: Scaffold(body: Center(child: child)));
  }

  final testCodes = [0, 2, 61, 73, 95, 45, 999];

  for (final code in testCodes) {
    testWidgets('WeatherAnimationWidget renders for code $code', (tester) async {
      await tester.pumpWidget(_wrap(WeatherAnimationWidget(weatherCode: code)));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(WeatherAnimationWidget), findsOneWidget);
    });
  }
}
