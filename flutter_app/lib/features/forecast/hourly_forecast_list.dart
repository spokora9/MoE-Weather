import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:moe_weather/api/models/weather_response.dart';
import 'weather_code_icon.dart';

class HourlyForecastList extends StatelessWidget {
  const HourlyForecastList({super.key, required this.hours});

  final List<HourlyForecast> hours;

  @override
  Widget build(BuildContext context) {
    final displayHours = hours.take(24).toList();
    if (displayHours.isEmpty) return const SizedBox.shrink();

    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    final temps = displayHours.map((h) => h.temperature).toList();
    final minTemp = temps.reduce((a, b) => a < b ? a : b);
    final maxTemp = temps.reduce((a, b) => a > b ? a : b);
    // Add padding so dots aren't clipped on the chart edges
    final yMin = minTemp - 1;
    final yMax = maxTemp + 1;

    final spots = <FlSpot>[
      for (int i = 0; i < displayHours.length; i++)
        FlSpot(i.toDouble(), displayHours[i].temperature),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Text('Hourly', style: tt.titleSmall?.copyWith(color: cs.onSurfaceVariant)),
        ),
        // Temperature line chart
        SizedBox(
          height: 140,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
            child: LineChart(
              LineChartData(
                minX: 0,
                maxX: (displayHours.length - 1).toDouble(),
                minY: yMin,
                maxY: yMax,
                lineTouchData: const LineTouchData(enabled: false),
                gridData: const FlGridData(show: false),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 36,
                      getTitlesWidget: (value, meta) {
                        if (value == yMin || value == yMax) {
                          return Text(
                            '${value.round()}°',
                            style: tt.labelSmall?.copyWith(color: cs.onSurfaceVariant),
                          );
                        }
                        return const SizedBox.shrink();
                      },
                    ),
                  ),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 20,
                      interval: 1,
                      getTitlesWidget: (value, meta) {
                        final idx = value.round();
                        final labels = {0: '0h', 6: '6h', 12: '12h', 18: '18h', 23: '24h'};
                        final label = labels[idx];
                        if (label == null) return const SizedBox.shrink();
                        return Text(
                          label,
                          style: tt.labelSmall?.copyWith(color: cs.onSurfaceVariant),
                        );
                      },
                    ),
                  ),
                ),
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    isCurved: true,
                    color: cs.primary,
                    barWidth: 2,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      color: cs.primary.withAlpha(30),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        // Scrollable hourly items
        SizedBox(
          height: 90,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            itemCount: displayHours.length,
            itemBuilder: (context, index) {
              final hour = displayHours[index];
              final timeLabel =
                  '${hour.time.hour.toString().padLeft(2, '0')}:${hour.time.minute.toString().padLeft(2, '0')}';
              final precipProb = hour.precipitationProbability.round();
              return SizedBox(
                width: 56,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      timeLabel,
                      style: tt.labelSmall?.copyWith(color: cs.onSurfaceVariant),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 4),
                    Icon(
                      weatherCodeIcon(hour.weatherCode),
                      size: 20,
                      color: weatherCodeColor(hour.weatherCode, cs),
                    ),
                    const SizedBox(height: 4),
                    if (precipProb > 10)
                      Text(
                        '$precipProb%',
                        style: tt.labelSmall?.copyWith(color: cs.primary),
                        textAlign: TextAlign.center,
                      )
                    else
                      const SizedBox(height: 14),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
