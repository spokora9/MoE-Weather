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
}
