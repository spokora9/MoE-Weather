import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:moe_weather/api/models/weather_response.dart';
import 'package:moe_weather/features/auth/auth_state.dart';
import 'package:moe_weather/features/auth/revenuecat_service.dart';
import 'widget_data.dart';
import 'widget_data_service.dart';

Future<bool> pushWeatherToWidget({
  required WidgetRef ref,
  required WeatherResponse weather,
  required String locationName,
  String unitLabel = '°C',
}) async {
  final tier = ref.read(tierProvider);
  if (tier != SubscriptionTier.pro) return false;
  final current = weather.current;
  if (current == null) return false;

  final today = weather.daily.isNotEmpty ? weather.daily.first : null;
  final activeAlert = weather.alerts.where((a) => a.end.isAfter(DateTime.now())).firstOrNull;

  // Next 7 hourly entries starting from the closest future hour.
  final now = DateTime.now();
  final hourly = weather.hourly
      .where((h) => h.time.isAfter(now))
      .take(7)
      .map((h) => HourlyWidgetEntry(
            time: h.time,
            temperature: h.temperature,
            feelsLike: h.feelsLike,
            weatherCode: h.weatherCode,
          ))
      .toList();

  final snapshot = WidgetSnapshot(
    temperature: current.temperature,
    feelsLike: current.feelsLike,
    description: current.weatherDescription,
    weatherCode: current.weatherCode,
    locationName: locationName,
    humidity: current.humidity,
    windSpeed: current.windSpeed,
    highTemp: today?.temperatureMax,
    lowTemp: today?.temperatureMin,
    lastUpdated: current.timestamp,
    unitLabel: unitLabel,
    hourly: hourly,
    sunrise: today?.sunrise,
    sunset: today?.sunset,
    alertText: activeAlert?.headline,
    alertEnd: activeAlert?.end,
  );

  await ref.read(widgetDataServiceProvider).updateWidget(snapshot);
  return true;
}
