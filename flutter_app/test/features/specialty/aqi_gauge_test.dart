import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:moe_weather/features/specialty/aqi_gauge.dart';

void main() {
  group('AqiGauge', () {
    testWidgets('renders for aqi 0 without throwing', (tester) async {
      await tester.pumpWidget(const MaterialApp(home: Scaffold(body: AqiGauge(aqi: 0))));
      expect(find.byType(AqiGauge), findsOneWidget);
    });

    testWidgets('renders for aqi 150 without throwing', (tester) async {
      await tester.pumpWidget(const MaterialApp(home: Scaffold(body: AqiGauge(aqi: 150))));
      expect(find.byType(AqiGauge), findsOneWidget);
    });

    testWidgets('renders for aqi 300 without throwing', (tester) async {
      await tester.pumpWidget(const MaterialApp(home: Scaffold(body: AqiGauge(aqi: 300))));
      expect(find.byType(AqiGauge), findsOneWidget);
    });
  });
}
