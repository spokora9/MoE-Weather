class AirQualityResponse {
  const AirQualityResponse({
    required this.aqi,
    required this.category,
    required this.pm25,
    required this.pm10,
    required this.o3,
    required this.no2,
    required this.co,
    required this.so2,
    required this.timestamp,
  });

  factory AirQualityResponse.fromJson(Map<String, dynamic> json) {
    return AirQualityResponse(
      aqi: (json['aqi'] as num).toInt(),
      category: json['category'] as String,
      pm25: _double(json['pm25']),
      pm10: _double(json['pm10']),
      o3: _double(json['o3']),
      no2: _double(json['no2']),
      co: _double(json['co']),
      so2: _double(json['so2']),
      timestamp: _dateTime(json['timestamp']),
    );
  }

  final int aqi;
  final String category;
  final double pm25;
  final double pm10;
  final double o3;
  final double no2;
  final double co;
  final double so2;
  final DateTime timestamp;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'aqi': aqi,
        'category': category,
        'pm25': pm25,
        'pm10': pm10,
        'o3': o3,
        'no2': no2,
        'co': co,
        'so2': so2,
        'timestamp': timestamp.toIso8601String(),
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AirQualityResponse &&
          other.aqi == aqi &&
          other.category == category &&
          other.pm25 == pm25 &&
          other.pm10 == pm10 &&
          other.o3 == o3 &&
          other.no2 == no2 &&
          other.co == co &&
          other.so2 == so2 &&
          other.timestamp == timestamp);

  @override
  int get hashCode =>
      Object.hash(runtimeType, aqi, category, pm25, pm10, o3, no2, co, so2, timestamp);
}

double _double(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.parse(value);
  throw FormatException('Expected number, got ${value.runtimeType}');
}

DateTime _dateTime(Object? value) {
  if (value is DateTime) return value;
  if (value is String) return DateTime.parse(value);
  if (value is num) return DateTime.fromMillisecondsSinceEpoch(value.toInt());
  throw FormatException('Expected date string, got ${value.runtimeType}');
}
