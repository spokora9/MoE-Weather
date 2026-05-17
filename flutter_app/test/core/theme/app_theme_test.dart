import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:moe_weather/core/theme/app_theme.dart';

void main() {
  group('AppTheme', () {
    test('light theme has Brightness.light', () {
      expect(AppTheme.light.brightness, Brightness.light);
    });

    test('dark theme has Brightness.dark', () {
      expect(AppTheme.dark.brightness, Brightness.dark);
    });

    test('light theme uses Material 3', () {
      expect(AppTheme.light.useMaterial3, true);
    });
  });
}
