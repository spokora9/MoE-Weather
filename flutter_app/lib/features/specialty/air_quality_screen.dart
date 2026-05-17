import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'aqi_gauge.dart';
import 'specialty_providers.dart';

class AirQualityScreen extends ConsumerStatefulWidget {
  const AirQualityScreen({super.key, required this.lat, required this.lon});

  final double lat;
  final double lon;

  @override
  ConsumerState<AirQualityScreen> createState() => _AirQualityScreenState();
}

class _AirQualityScreenState extends ConsumerState<AirQualityScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(airQualityProvider.notifier).load(widget.lat, widget.lon),
    );
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(airQualityProvider);
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
                'Could not load air quality data',
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
                onPressed: () =>
                    ref.read(airQualityProvider.notifier).refresh(),
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
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            children: [
              Center(child: AqiGauge(aqi: data.aqi, size: 200)),
              const SizedBox(height: 8),
              Text(
                data.category,
                style: theme.textTheme.titleLarge?.copyWith(
                  color: cs.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Updated $ts',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: cs.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 20),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: GridView.count(
                  crossAxisCount: 3,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 1.2,
                  children: [
                    _PollutantCard(
                      label: 'PM2.5',
                      value: data.pm25.toStringAsFixed(1),
                      unit: 'μg/m³',
                    ),
                    _PollutantCard(
                      label: 'PM10',
                      value: data.pm10.toStringAsFixed(1),
                      unit: 'μg/m³',
                    ),
                    _PollutantCard(
                      label: 'O₃',
                      value: data.o3.toStringAsFixed(1),
                      unit: 'ppb',
                    ),
                    _PollutantCard(
                      label: 'NO₂',
                      value: data.no2.toStringAsFixed(1),
                      unit: 'ppb',
                    ),
                    _PollutantCard(
                      label: 'CO',
                      value: data.co.toStringAsFixed(2),
                      unit: 'ppm',
                    ),
                    _PollutantCard(
                      label: 'SO₂',
                      value: data.so2.toStringAsFixed(1),
                      unit: 'ppb',
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _PollutantCard extends StatelessWidget {
  const _PollutantCard({
    required this.label,
    required this.value,
    required this.unit,
  });

  final String label;
  final String value;
  final String unit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              label,
              style: theme.textTheme.labelSmall?.copyWith(
                color: cs.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: theme.textTheme.titleMedium?.copyWith(
                color: cs.onSurface,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              unit,
              style: theme.textTheme.labelSmall?.copyWith(
                color: cs.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
