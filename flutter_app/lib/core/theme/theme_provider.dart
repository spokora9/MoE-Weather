import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive/hive.dart';

import 'app_theme.dart';

enum AppThemeMode { system, light, dark }

class ThemeModeNotifier extends Notifier<AppThemeMode> {
  static const _boxName = 'app_theme';
  static const _key = 'mode';

  @override
  AppThemeMode build() {
    if (!Hive.isBoxOpen(_boxName)) {
      return AppThemeMode.system;
    }
    final box = Hive.box(_boxName);
    final stored = box.get(_key) as String?;
    if (stored == null) return AppThemeMode.system;
    return AppThemeMode.values.firstWhere(
      (m) => m.name == stored,
      orElse: () => AppThemeMode.system,
    );
  }

  Future<void> setMode(AppThemeMode mode) async {
    final box = Hive.isBoxOpen(_boxName)
        ? Hive.box(_boxName)
        : await Hive.openBox(_boxName);
    await box.put(_key, mode.name);
    state = mode;
  }
}

final themeModeProvider =
    NotifierProvider<ThemeModeNotifier, AppThemeMode>(ThemeModeNotifier.new);

final themeDataProvider = Provider<(ThemeData, ThemeData)>((ref) {
  return (AppTheme.light, AppTheme.dark);
});
