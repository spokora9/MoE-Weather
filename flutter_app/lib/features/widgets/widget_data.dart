abstract final class WidgetDataKeys {
  static const String temperature = 'widget_temperature';
  static const String feelsLike = 'widget_feels_like';
  static const String description = 'widget_description';
  static const String weatherCode = 'widget_weather_code';
  static const String locationName = 'widget_location_name';
  static const String humidity = 'widget_humidity';
  static const String windSpeed = 'widget_wind_speed';
  static const String highTemp = 'widget_high_temp';
  static const String lowTemp = 'widget_low_temp';
  static const String lastUpdated = 'widget_last_updated';
  static const String unitLabel = 'widget_unit_label';
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
