import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:moe_weather/features/auth/auth_state.dart';
import 'package:moe_weather/features/auth/revenuecat_service.dart';
import 'package:moe_weather/core/theme/theme_provider.dart';
import 'settings_model.dart';
import 'settings_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settingsAsync = ref.watch(settingsProvider);
    final tier = ref.watch(tierProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: settingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Error: $error')),
        data: (settings) => _SettingsBody(
          settings: settings,
          tier: tier,
          onChanged: (updated) =>
              ref.read(settingsProvider.notifier).update(updated),
        ),
      ),
    );
  }
}

class _SettingsBody extends ConsumerWidget {
  const _SettingsBody({
    required this.settings,
    required this.tier,
    required this.onChanged,
  });

  final AppSettings settings;
  final SubscriptionTier tier;
  final void Function(AppSettings) onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final themeMode = ref.watch(themeModeProvider);

    return ListView(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
          child: Text('Theme', style: textTheme.titleSmall?.copyWith(
            color: colorScheme.primary,
          )),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: SegmentedButton<AppThemeMode>(
            segments: const [
              ButtonSegment(
                value: AppThemeMode.system,
                label: Text('System'),
                icon: Icon(Icons.brightness_auto),
              ),
              ButtonSegment(
                value: AppThemeMode.light,
                label: Text('Light'),
                icon: Icon(Icons.light_mode),
              ),
              ButtonSegment(
                value: AppThemeMode.dark,
                label: Text('Dark'),
                icon: Icon(Icons.dark_mode),
              ),
            ],
            selected: {themeMode},
            onSelectionChanged: (selected) {
              ref.read(themeModeProvider.notifier).setMode(selected.first);
            },
          ),
        ),
        const Divider(),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
          child: Text('Units', style: textTheme.titleSmall?.copyWith(
            color: colorScheme.primary,
          )),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              const Expanded(child: Text('Temperature')),
              SegmentedButton<TemperatureUnit>(
                segments: const [
                  ButtonSegment(
                    value: TemperatureUnit.celsius,
                    label: Text('°C'),
                  ),
                  ButtonSegment(
                    value: TemperatureUnit.fahrenheit,
                    label: Text('°F'),
                  ),
                ],
                selected: {settings.temperatureUnit},
                onSelectionChanged: (selected) {
                  onChanged(settings.copyWith(temperatureUnit: selected.first));
                },
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              const Expanded(child: Text('Wind Speed')),
              DropdownButton<WindSpeedUnit>(
                value: settings.windSpeedUnit,
                items: WindSpeedUnit.values.map((unit) {
                  return DropdownMenuItem(
                    value: unit,
                    child: Text(windSpeedLabel(unit)),
                  );
                }).toList(),
                onChanged: (unit) {
                  if (unit != null) {
                    onChanged(settings.copyWith(windSpeedUnit: unit));
                  }
                },
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              const Expanded(child: Text('Pressure')),
              DropdownButton<PressureUnit>(
                value: settings.pressureUnit,
                items: PressureUnit.values.map((unit) {
                  return DropdownMenuItem(
                    value: unit,
                    child: Text(_pressureLabel(unit)),
                  );
                }).toList(),
                onChanged: (unit) {
                  if (unit != null) {
                    onChanged(settings.copyWith(pressureUnit: unit));
                  }
                },
              ),
            ],
          ),
        ),
        SwitchListTile(
          title: const Text('24-hour clock'),
          value: settings.use24HourClock,
          onChanged: (value) =>
              onChanged(settings.copyWith(use24HourClock: value)),
        ),
        const Divider(),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: Text('Display', style: textTheme.titleSmall?.copyWith(
            color: colorScheme.primary,
          )),
        ),
        SwitchListTile(
          title: const Text('Show weather alerts'),
          value: settings.showAlerts,
          onChanged: (value) =>
              onChanged(settings.copyWith(showAlerts: value)),
        ),
        const Divider(),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: Text('Pro features', style: textTheme.titleSmall?.copyWith(
            color: colorScheme.primary,
          )),
        ),
        ListTile(
          title: const Text('Advanced Charts'),
          trailing: tier == SubscriptionTier.pro
              ? Icon(Icons.check_circle, color: colorScheme.primary)
              : const Icon(Icons.lock),
        ),
      ],
    );
  }

  String _pressureLabel(PressureUnit unit) {
    return switch (unit) {
      PressureUnit.hpa => 'hPa',
      PressureUnit.inhg => 'inHg',
      PressureUnit.mmhg => 'mmHg',
    };
  }
}
