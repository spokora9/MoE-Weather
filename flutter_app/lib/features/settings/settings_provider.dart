import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'settings_model.dart';
import 'settings_repository.dart';

class SettingsNotifier extends AsyncNotifier<AppSettings> {
  @override
  Future<AppSettings> build() =>
      ref.read(settingsRepositoryProvider).load();

  Future<void> update(AppSettings settings) async {
    await ref.read(settingsRepositoryProvider).save(settings);
    state = AsyncData(settings);
  }
}

final settingsProvider =
    AsyncNotifierProvider<SettingsNotifier, AppSettings>(SettingsNotifier.new);
