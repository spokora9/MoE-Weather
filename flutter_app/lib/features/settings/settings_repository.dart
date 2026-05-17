import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'settings_model.dart';

const _boxName = 'app_settings';
const _settingsKey = 'settings';

class SettingsRepository {
  Future<AppSettings> load() async {
    final box = await Hive.openBox<String>(_boxName);
    final raw = box.get(_settingsKey);
    if (raw == null) return const AppSettings();
    return AppSettings.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<void> save(AppSettings settings) async {
    final box = await Hive.openBox<String>(_boxName);
    await box.put(_settingsKey, jsonEncode(settings.toJson()));
  }
}

final settingsRepositoryProvider = Provider<SettingsRepository>(
  (_) => SettingsRepository(),
);
