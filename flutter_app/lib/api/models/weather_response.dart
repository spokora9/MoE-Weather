/// Models for `GET /api/weather`.
///
/// Implementation note: hand-written equivalents of what `freezed +
/// json_serializable` would emit. We can't run the build_runner code-gen in
/// this sandbox so the fromJson/toJson + equality/copyWith plumbing is
/// inlined here.

/// Top-level `GET /api/weather` response.
class WeatherResponse {
  const WeatherResponse({
    required this.location,
    this.current,
    this.hourly = const <HourlyForecast>[],
    this.daily = const <DailyForecast>[],
    this.alerts = const <WeatherAlert>[],
    this.metadata,
    this.units,
  });

  factory WeatherResponse.fromJson(Map<String, dynamic> json) {
    return WeatherResponse(
      location:
          WeatherLocation.fromJson(_asMap(json['location'], 'location')),
      current: json['current'] == null
          ? null
          : CurrentWeather.fromJson(_asMap(json['current'], 'current')),
      hourly: _list(json['hourly'])
          .map((e) => HourlyForecast.fromJson(_asMap(e, 'hourly[]')))
          .toList(growable: false),
      daily: _list(json['daily'])
          .map((e) => DailyForecast.fromJson(_asMap(e, 'daily[]')))
          .toList(growable: false),
      alerts: _list(json['alerts'])
          .map((e) => WeatherAlert.fromJson(_asMap(e, 'alerts[]')))
          .toList(growable: false),
      metadata: json['metadata'] == null
          ? null
          : WeatherMetadata.fromJson(_asMap(json['metadata'], 'metadata')),
      units: json['units'] == null
          ? null
          : WeatherUnits.fromJson(_asMap(json['units'], 'units')),
    );
  }

  final WeatherLocation location;
  final CurrentWeather? current;
  final List<HourlyForecast> hourly;
  final List<DailyForecast> daily;
  final List<WeatherAlert> alerts;
  final WeatherMetadata? metadata;
  final WeatherUnits? units;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'location': location.toJson(),
        if (current != null) 'current': current!.toJson(),
        'hourly': hourly.map((e) => e.toJson()).toList(),
        'daily': daily.map((e) => e.toJson()).toList(),
        'alerts': alerts.map((e) => e.toJson()).toList(),
        if (metadata != null) 'metadata': metadata!.toJson(),
        if (units != null) 'units': units!.toJson(),
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is WeatherResponse &&
          other.location == location &&
          other.current == current);

  @override
  int get hashCode => Object.hash(runtimeType, location, current);
}

class WeatherLocation {
  const WeatherLocation({
    required this.name,
    required this.country,
    required this.coordinates,
    this.timezone,
  });

  factory WeatherLocation.fromJson(Map<String, dynamic> json) =>
      WeatherLocation(
        name: json['name'] as String,
        country: json['country'] as String,
        coordinates:
            WeatherCoordinates.fromJson(_asMap(json['coordinates'], 'coordinates')),
        timezone: json['timezone'] as String?,
      );

  final String name;
  final String country;
  final WeatherCoordinates coordinates;
  final String? timezone;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'name': name,
        'country': country,
        'coordinates': coordinates.toJson(),
        if (timezone != null) 'timezone': timezone,
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is WeatherLocation &&
          other.name == name &&
          other.country == country &&
          other.coordinates == coordinates &&
          other.timezone == timezone);

  @override
  int get hashCode =>
      Object.hash(runtimeType, name, country, coordinates, timezone);
}

class WeatherCoordinates {
  const WeatherCoordinates({required this.latitude, required this.longitude});

  factory WeatherCoordinates.fromJson(Map<String, dynamic> json) =>
      WeatherCoordinates(
        latitude: _double(json['latitude']),
        longitude: _double(json['longitude']),
      );

  final double latitude;
  final double longitude;

  Map<String, dynamic> toJson() =>
      <String, dynamic>{'latitude': latitude, 'longitude': longitude};

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is WeatherCoordinates &&
          other.latitude == latitude &&
          other.longitude == longitude);

  @override
  int get hashCode => Object.hash(runtimeType, latitude, longitude);
}

class CurrentWeather {
  const CurrentWeather({
    required this.temperature,
    required this.feelsLike,
    required this.humidity,
    required this.pressure,
    required this.windSpeed,
    required this.windDirection,
    this.windGust,
    required this.visibility,
    this.uvIndex,
    required this.cloudCover,
    this.precipitation,
    required this.weatherCode,
    required this.weatherDescription,
    required this.timestamp,
  });

  factory CurrentWeather.fromJson(Map<String, dynamic> json) => CurrentWeather(
        temperature: _double(json['temperature']),
        feelsLike: _double(json['feelsLike']),
        humidity: _double(json['humidity']),
        pressure: _double(json['pressure']),
        windSpeed: _double(json['windSpeed']),
        windDirection: _double(json['windDirection']),
        windGust: _doubleOrNull(json['windGust']),
        visibility: _double(json['visibility']),
        uvIndex: _doubleOrNull(json['uvIndex']),
        cloudCover: _double(json['cloudCover']),
        precipitation: _doubleOrNull(json['precipitation']),
        weatherCode: (json['weatherCode'] as num).toInt(),
        weatherDescription: json['weatherDescription'] as String,
        timestamp: _dateTime(json['timestamp']),
      );

  final double temperature;
  final double feelsLike;
  final double humidity;
  final double pressure;
  final double windSpeed;
  final double windDirection;
  final double? windGust;
  final double visibility;
  final double? uvIndex;
  final double cloudCover;
  final double? precipitation;
  final int weatherCode;
  final String weatherDescription;
  final DateTime timestamp;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'temperature': temperature,
        'feelsLike': feelsLike,
        'humidity': humidity,
        'pressure': pressure,
        'windSpeed': windSpeed,
        'windDirection': windDirection,
        if (windGust != null) 'windGust': windGust,
        'visibility': visibility,
        if (uvIndex != null) 'uvIndex': uvIndex,
        'cloudCover': cloudCover,
        if (precipitation != null) 'precipitation': precipitation,
        'weatherCode': weatherCode,
        'weatherDescription': weatherDescription,
        'timestamp': timestamp.toIso8601String(),
      };
}

class HourlyForecast {
  const HourlyForecast({
    required this.time,
    required this.temperature,
    required this.feelsLike,
    required this.humidity,
    required this.pressure,
    required this.windSpeed,
    required this.windDirection,
    this.windGust,
    required this.precipitation,
    this.rain,
    this.showers,
    this.snowfall,
    required this.precipitationProbability,
    required this.weatherCode,
    required this.weatherDescription,
    required this.cloudCover,
    this.uvIndex,
    this.cape,
    this.visibility,
    this.freezingLevel,
  });

  factory HourlyForecast.fromJson(Map<String, dynamic> json) => HourlyForecast(
        time: _dateTime(json['time']),
        temperature: _double(json['temperature']),
        feelsLike: _double(json['feelsLike']),
        humidity: _double(json['humidity']),
        pressure: _double(json['pressure']),
        windSpeed: _double(json['windSpeed']),
        windDirection: _double(json['windDirection']),
        windGust: _doubleOrNull(json['windGust']),
        precipitation: _double(json['precipitation']),
        rain: _doubleOrNull(json['rain']),
        showers: _doubleOrNull(json['showers']),
        snowfall: _doubleOrNull(json['snowfall']),
        precipitationProbability: _double(json['precipitationProbability']),
        weatherCode: (json['weatherCode'] as num).toInt(),
        weatherDescription: json['weatherDescription'] as String,
        cloudCover: _double(json['cloudCover']),
        uvIndex: _doubleOrNull(json['uvIndex']),
        cape: _doubleOrNull(json['cape']),
        visibility: _doubleOrNull(json['visibility']),
        freezingLevel: _doubleOrNull(json['freezingLevel']),
      );

  final DateTime time;
  final double temperature;
  final double feelsLike;
  final double humidity;
  final double pressure;
  final double windSpeed;
  final double windDirection;
  final double? windGust;
  final double precipitation;
  final double? rain;
  final double? showers;
  final double? snowfall;
  final double precipitationProbability;
  final int weatherCode;
  final String weatherDescription;
  final double cloudCover;
  final double? uvIndex;
  final double? cape;
  final double? visibility;
  final double? freezingLevel;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'time': time.toIso8601String(),
        'temperature': temperature,
        'feelsLike': feelsLike,
        'humidity': humidity,
        'pressure': pressure,
        'windSpeed': windSpeed,
        'windDirection': windDirection,
        if (windGust != null) 'windGust': windGust,
        'precipitation': precipitation,
        if (rain != null) 'rain': rain,
        if (showers != null) 'showers': showers,
        if (snowfall != null) 'snowfall': snowfall,
        'precipitationProbability': precipitationProbability,
        'weatherCode': weatherCode,
        'weatherDescription': weatherDescription,
        'cloudCover': cloudCover,
        if (uvIndex != null) 'uvIndex': uvIndex,
        if (cape != null) 'cape': cape,
        if (visibility != null) 'visibility': visibility,
        if (freezingLevel != null) 'freezingLevel': freezingLevel,
      };
}

class DailyForecast {
  const DailyForecast({
    required this.date,
    required this.temperatureMax,
    required this.temperatureMin,
    this.temperatureMorning,
    this.temperatureAfternoon,
    this.temperatureEvening,
    this.temperatureNight,
    required this.humidity,
    required this.pressure,
    required this.windSpeed,
    this.windGust,
    required this.windDirection,
    required this.precipitation,
    this.rain,
    this.showers,
    this.snowfall,
    this.precipitationHours,
    required this.precipitationProbability,
    required this.weatherCode,
    required this.weatherDescription,
    required this.sunrise,
    required this.sunset,
    this.uvIndex,
  });

  factory DailyForecast.fromJson(Map<String, dynamic> json) => DailyForecast(
        date: _dateTime(json['date']),
        temperatureMax: _double(json['temperatureMax']),
        temperatureMin: _double(json['temperatureMin']),
        temperatureMorning: _doubleOrNull(json['temperatureMorning']),
        temperatureAfternoon: _doubleOrNull(json['temperatureAfternoon']),
        temperatureEvening: _doubleOrNull(json['temperatureEvening']),
        temperatureNight: _doubleOrNull(json['temperatureNight']),
        humidity: _double(json['humidity']),
        pressure: _double(json['pressure']),
        windSpeed: _double(json['windSpeed']),
        windGust: _doubleOrNull(json['windGust']),
        windDirection: _double(json['windDirection']),
        precipitation: _double(json['precipitation']),
        rain: _doubleOrNull(json['rain']),
        showers: _doubleOrNull(json['showers']),
        snowfall: _doubleOrNull(json['snowfall']),
        precipitationHours: _doubleOrNull(json['precipitationHours']),
        precipitationProbability: _double(json['precipitationProbability']),
        weatherCode: (json['weatherCode'] as num).toInt(),
        weatherDescription: json['weatherDescription'] as String,
        sunrise: _dateTime(json['sunrise']),
        sunset: _dateTime(json['sunset']),
        uvIndex: _doubleOrNull(json['uvIndex']),
      );

  final DateTime date;
  final double temperatureMax;
  final double temperatureMin;
  final double? temperatureMorning;
  final double? temperatureAfternoon;
  final double? temperatureEvening;
  final double? temperatureNight;
  final double humidity;
  final double pressure;
  final double windSpeed;
  final double? windGust;
  final double windDirection;
  final double precipitation;
  final double? rain;
  final double? showers;
  final double? snowfall;
  final double? precipitationHours;
  final double precipitationProbability;
  final int weatherCode;
  final String weatherDescription;
  final DateTime sunrise;
  final DateTime sunset;
  final double? uvIndex;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'date': date.toIso8601String(),
        'temperatureMax': temperatureMax,
        'temperatureMin': temperatureMin,
        if (temperatureMorning != null) 'temperatureMorning': temperatureMorning,
        if (temperatureAfternoon != null)
          'temperatureAfternoon': temperatureAfternoon,
        if (temperatureEvening != null) 'temperatureEvening': temperatureEvening,
        if (temperatureNight != null) 'temperatureNight': temperatureNight,
        'humidity': humidity,
        'pressure': pressure,
        'windSpeed': windSpeed,
        if (windGust != null) 'windGust': windGust,
        'windDirection': windDirection,
        'precipitation': precipitation,
        if (rain != null) 'rain': rain,
        if (showers != null) 'showers': showers,
        if (snowfall != null) 'snowfall': snowfall,
        if (precipitationHours != null) 'precipitationHours': precipitationHours,
        'precipitationProbability': precipitationProbability,
        'weatherCode': weatherCode,
        'weatherDescription': weatherDescription,
        'sunrise': sunrise.toIso8601String(),
        'sunset': sunset.toIso8601String(),
        if (uvIndex != null) 'uvIndex': uvIndex,
      };
}

class WeatherAlert {
  const WeatherAlert({
    required this.id,
    required this.event,
    required this.headline,
    required this.description,
    required this.severity,
    required this.urgency,
    required this.start,
    required this.end,
    required this.source,
  });

  factory WeatherAlert.fromJson(Map<String, dynamic> json) => WeatherAlert(
        id: json['id'] as String,
        event: json['event'] as String,
        headline: json['headline'] as String,
        description: json['description'] as String,
        severity: json['severity'] as String,
        urgency: json['urgency'] as String,
        start: _dateTime(json['start']),
        end: _dateTime(json['end']),
        source: json['source'] as String,
      );

  final String id;
  final String event;
  final String headline;
  final String description;
  final String severity;
  final String urgency;
  final DateTime start;
  final DateTime end;
  final String source;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'event': event,
        'headline': headline,
        'description': description,
        'severity': severity,
        'urgency': urgency,
        'start': start.toIso8601String(),
        'end': end.toIso8601String(),
        'source': source,
      };
}

class WeatherMetadata {
  const WeatherMetadata({
    this.sources = const <WeatherSourceInfo>[],
    this.confidence,
    this.fetchedAt,
    this.cacheExpiry,
  });

  factory WeatherMetadata.fromJson(Map<String, dynamic> json) =>
      WeatherMetadata(
        sources: _list(json['sources'])
            .map((e) => WeatherSourceInfo.fromJson(_asMap(e, 'sources[]')))
            .toList(growable: false),
        confidence: json['confidence'] == null
            ? null
            : WeatherConfidence.fromJson(
                _asMap(json['confidence'], 'confidence')),
        fetchedAt: _dateTimeOrNull(json['fetchedAt']),
        cacheExpiry: _dateTimeOrNull(json['cacheExpiry']),
      );

  final List<WeatherSourceInfo> sources;
  final WeatherConfidence? confidence;
  final DateTime? fetchedAt;
  final DateTime? cacheExpiry;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'sources': sources.map((e) => e.toJson()).toList(),
        if (confidence != null) 'confidence': confidence!.toJson(),
        if (fetchedAt != null) 'fetchedAt': fetchedAt!.toIso8601String(),
        if (cacheExpiry != null) 'cacheExpiry': cacheExpiry!.toIso8601String(),
      };
}

class WeatherSourceInfo {
  const WeatherSourceInfo({
    required this.name,
    required this.weight,
    required this.responseTime,
    this.dataFreshness,
  });

  factory WeatherSourceInfo.fromJson(Map<String, dynamic> json) =>
      WeatherSourceInfo(
        name: json['name'] as String,
        weight: _double(json['weight']),
        responseTime: _double(json['responseTime']),
        dataFreshness: _dateTimeOrNull(json['dataFreshness']),
      );

  final String name;
  final double weight;
  final double responseTime;
  final DateTime? dataFreshness;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'name': name,
        'weight': weight,
        'responseTime': responseTime,
        if (dataFreshness != null)
          'dataFreshness': dataFreshness!.toIso8601String(),
      };
}

class WeatherConfidence {
  const WeatherConfidence({
    required this.overall,
    required this.temperature,
    required this.precipitation,
    required this.wind,
    required this.agreement,
  });

  factory WeatherConfidence.fromJson(Map<String, dynamic> json) =>
      WeatherConfidence(
        overall: _double(json['overall']),
        temperature: _double(json['temperature']),
        precipitation: _double(json['precipitation']),
        wind: _double(json['wind']),
        agreement: _double(json['agreement']),
      );

  final double overall;
  final double temperature;
  final double precipitation;
  final double wind;
  final double agreement;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'overall': overall,
        'temperature': temperature,
        'precipitation': precipitation,
        'wind': wind,
        'agreement': agreement,
      };
}

/// Wraps the `{ locale, labels }` block appended by `src/server.ts` so the
/// client can format values without re-deriving locale rules.
class WeatherUnits {
  const WeatherUnits({required this.locale, required this.labels});

  factory WeatherUnits.fromJson(Map<String, dynamic> json) => WeatherUnits(
        locale: json['locale'] as String,
        labels: (json['labels'] as Map).map(
          (key, value) => MapEntry(key as String, value.toString()),
        ),
      );

  final String locale;
  final Map<String, String> labels;

  Map<String, dynamic> toJson() =>
      <String, dynamic>{'locale': locale, 'labels': labels};
}

// ─── Internal coercion helpers ────────────────────────────────────────────

Map<String, dynamic> _asMap(Object? value, String field) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return value.cast<String, dynamic>();
  throw FormatException('Expected object for "$field", got ${value.runtimeType}');
}

List<dynamic> _list(Object? value) {
  if (value is List) return value;
  return const <dynamic>[];
}

double _double(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.parse(value);
  throw FormatException('Expected number, got ${value.runtimeType}');
}

double? _doubleOrNull(Object? value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  if (value is String) {
    if (value.isEmpty) return null;
    return double.tryParse(value);
  }
  return null;
}

DateTime _dateTime(Object? value) {
  if (value is DateTime) return value;
  if (value is String) return DateTime.parse(value);
  if (value is num) {
    return DateTime.fromMillisecondsSinceEpoch(value.toInt());
  }
  throw FormatException('Expected date string, got ${value.runtimeType}');
}

DateTime? _dateTimeOrNull(Object? value) {
  if (value == null) return null;
  try {
    return _dateTime(value);
  } on FormatException {
    return null;
  }
}
