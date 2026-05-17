import 'package:flutter/material.dart';
import 'package:moe_weather/api/models/weather_response.dart';
import 'weather_code_icon.dart';

class CurrentConditionsCard extends StatelessWidget {
  const CurrentConditionsCard({
    super.key,
    required this.current,
    required this.locationName,
    this.animationWidget,
  });

  final CurrentWeather current;
  final String locationName;
  final Widget? animationWidget;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Card(
      elevation: 0,
      color: cs.surfaceContainerHighest,
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Location name
            Text(locationName, style: tt.titleMedium?.copyWith(color: cs.onSurfaceVariant)),
            const SizedBox(height: 8),
            if (animationWidget != null) ...[
              Center(child: animationWidget!),
              const SizedBox(height: 8),
            ],
            // Temperature + feels-like
            Text(
              '${current.temperature.round()}°',
              style: tt.displayMedium?.copyWith(color: cs.onSurface),
            ),
            Text(
              'Feels like ${current.feelsLike.round()}°',
              style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
            ),
            const SizedBox(height: 12),
            // Weather icon + description
            Row(
              children: [
                Icon(
                  weatherCodeIcon(current.weatherCode),
                  color: weatherCodeColor(current.weatherCode, cs),
                  size: 32,
                ),
                const SizedBox(width: 8),
                Text(current.weatherDescription, style: tt.titleMedium?.copyWith(color: cs.onSurface)),
              ],
            ),
            const SizedBox(height: 16),
            // Info chips row
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _InfoChip(label: 'Humidity', value: '${current.humidity.round()}%', cs: cs),
                _InfoChip(label: 'Wind', value: '${current.windSpeed.round()} km/h', cs: cs),
                if (current.uvIndex != null)
                  _InfoChip(label: 'UV', value: current.uvIndex!.round().toString(), cs: cs),
                if (current.precipitation != null)
                  _InfoChip(label: 'Precip', value: '${current.precipitation!} mm', cs: cs),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, required this.value, required this.cs});
  final String label;
  final String value;
  final ColorScheme cs;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        '$label: $value',
        style: Theme.of(context).textTheme.labelMedium?.copyWith(color: cs.onSurface),
      ),
    );
  }
}
