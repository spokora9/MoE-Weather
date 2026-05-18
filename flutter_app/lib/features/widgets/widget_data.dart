class HourlyWidgetEntry {
  const HourlyWidgetEntry({
    required this.time,
    required this.temperature,
    required this.feelsLike,
    required this.weatherCode,
  });

  final DateTime time;
  final double temperature;
  final double feelsLike;
  final int weatherCode;
}

class WidgetSnapshot {
  const WidgetSnapshot({
    required this.temperature,
    required this.feelsLike,
    required this.description,
    required this.weatherCode,
    required this.locationName,
    required this.humidity,
    required this.windSpeed,
    this.highTemp,
    this.lowTemp,
    required this.lastUpdated,
    this.unitLabel = '°C',
    this.hourly = const [],
    this.sunrise,
    this.sunset,
    this.alertText,
    this.alertEnd,
  });

  final double temperature;
  final double feelsLike;
  final String description;
  final int weatherCode;
  final String locationName;
  final double humidity;
  final double windSpeed;
  final double? highTemp;
  final double? lowTemp;
  final DateTime lastUpdated;
  final String unitLabel;
  final List<HourlyWidgetEntry> hourly;
  final DateTime? sunrise;
  final DateTime? sunset;
  final String? alertText;
  final DateTime? alertEnd;
}
