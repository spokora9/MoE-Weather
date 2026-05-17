import 'package:flutter/material.dart';
import 'package:moe_weather/api/models/weather_response.dart';
import 'weather_code_icon.dart';

class DailyForecastList extends StatelessWidget {
  const DailyForecastList({super.key, required this.days});

  final List<DailyForecast> days;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final dimmed = tt.bodySmall?.copyWith(color: cs.onSurfaceVariant);
    final now = DateTime.now();

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: days.length,
      separatorBuilder: (_, __) => Divider(height: 1, color: cs.outlineVariant),
      itemBuilder: (context, index) {
        final day = days[index];
        final dayName = _dayLabel(day.date, now, index);
        final precipProb = day.precipitationProbability.round();

        return ListTile(
          leading: Icon(
            weatherCodeIcon(day.weatherCode),
            color: weatherCodeColor(day.weatherCode, cs),
          ),
          title: Text(dayName),
          subtitle: Text(day.weatherDescription, style: dimmed),
          trailing: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('${day.temperatureMax.round()}°', style: tt.bodyMedium),
              Text('${day.temperatureMin.round()}°', style: dimmed),
              if (precipProb > 10)
                Text('$precipProb%', style: tt.labelSmall?.copyWith(color: cs.primary)),
            ],
          ),
        );
      },
    );
  }

  String _dayLabel(DateTime date, DateTime now, int index) {
    if (index == 0) return 'Today';
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    // weekday is 1 (Mon) .. 7 (Sun); convert to 0-based index
    return names[date.weekday - 1];
  }
}
