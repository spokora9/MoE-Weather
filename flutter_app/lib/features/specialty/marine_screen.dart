import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'specialty_providers.dart';

class MarineScreen extends ConsumerStatefulWidget {
  const MarineScreen({super.key, required this.lat, required this.lon});

  final double lat;
  final double lon;

  @override
  ConsumerState<MarineScreen> createState() => _MarineScreenState();
}

class _MarineScreenState extends ConsumerState<MarineScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(marineProvider.notifier).load(widget.lat, widget.lon),
    );
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(marineProvider);
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: cs.error),
              const SizedBox(height: 12),
              Text(
                'Could not load marine data',
                style: theme.textTheme.titleMedium?.copyWith(color: cs.error),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                err.toString(),
                style: theme.textTheme.bodySmall?.copyWith(
                  color: cs.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => ref.read(marineProvider.notifier).refresh(),
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (data) {
        if (data == null) {
          return const Center(child: CircularProgressIndicator());
        }
        final ts = DateFormat('MMM d, HH:mm').format(data.timestamp.toLocal());
        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Hero row
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _HeroStat(
                        icon: Icons.waves,
                        label: 'Wave Height',
                        value: '${data.waveHeight.toStringAsFixed(1)} m',
                      ),
                      _HeroStat(
                        icon: Icons.timer_outlined,
                        label: 'Wave Period',
                        value: '${data.wavePeriod.toStringAsFixed(0)} s',
                      ),
                      _HeroStat(
                        icon: Icons.navigation,
                        label: 'Wave Dir.',
                        value: '${data.waveDirection.toStringAsFixed(0)}°',
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Swell',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: cs.onSurfaceVariant,
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _StatCard(
                    label: 'Swell Height',
                    value: '${data.swellHeight.toStringAsFixed(1)} m',
                  ),
                  _StatCard(
                    label: 'Swell Period',
                    value: '${data.swellPeriod.toStringAsFixed(0)} s',
                  ),
                  _StatCard(
                    label: 'Swell Direction',
                    value: '${data.swellDirection.toStringAsFixed(0)}°',
                  ),
                  _StatCard(
                    label: 'Wind Wave',
                    value: '${data.windWaveHeight.toStringAsFixed(1)} m',
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                'Ocean Conditions',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: cs.onSurfaceVariant,
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _StatCard(
                    label: 'Sea Surface Temp',
                    value: '${data.seaSurfaceTemp.toStringAsFixed(1)} °C',
                  ),
                  _StatCard(
                    label: 'Current Speed',
                    value: '${data.currentSpeed.toStringAsFixed(2)} m/s',
                  ),
                  _StatCard(
                    label: 'Current Direction',
                    value: '${data.currentDirection.toStringAsFixed(0)}°',
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                'Updated $ts',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: cs.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        );
      },
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: cs.primary, size: 28),
        const SizedBox(height: 4),
        Text(
          value,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: cs.onSurface,
          ),
        ),
        Text(
          label,
          style: theme.textTheme.labelSmall?.copyWith(
            color: cs.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return SizedBox(
      width: 140,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: cs.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                value,
                style: theme.textTheme.bodyLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: cs.onSurface,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
