class MarineResponse {
  const MarineResponse({
    required this.waveHeight,
    required this.wavePeriod,
    required this.waveDirection,
    required this.swellHeight,
    required this.swellPeriod,
    required this.swellDirection,
    required this.windWaveHeight,
    required this.seaSurfaceTemp,
    required this.currentSpeed,
    required this.currentDirection,
    required this.timestamp,
  });

  factory MarineResponse.fromJson(Map<String, dynamic> json) {
    return MarineResponse(
      waveHeight: _double(json['waveHeight']),
      wavePeriod: _double(json['wavePeriod']),
      waveDirection: _double(json['waveDirection']),
      swellHeight: _double(json['swellHeight']),
      swellPeriod: _double(json['swellPeriod']),
      swellDirection: _double(json['swellDirection']),
      windWaveHeight: _double(json['windWaveHeight']),
      seaSurfaceTemp: _double(json['seaSurfaceTemp']),
      currentSpeed: _double(json['currentSpeed']),
      currentDirection: _double(json['currentDirection']),
      timestamp: _dateTime(json['timestamp']),
    );
  }

  final double waveHeight;
  final double wavePeriod;
  final double waveDirection;
  final double swellHeight;
  final double swellPeriod;
  final double swellDirection;
  final double windWaveHeight;
  final double seaSurfaceTemp;
  final double currentSpeed;
  final double currentDirection;
  final DateTime timestamp;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'waveHeight': waveHeight,
        'wavePeriod': wavePeriod,
        'waveDirection': waveDirection,
        'swellHeight': swellHeight,
        'swellPeriod': swellPeriod,
        'swellDirection': swellDirection,
        'windWaveHeight': windWaveHeight,
        'seaSurfaceTemp': seaSurfaceTemp,
        'currentSpeed': currentSpeed,
        'currentDirection': currentDirection,
        'timestamp': timestamp.toIso8601String(),
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is MarineResponse &&
          other.waveHeight == waveHeight &&
          other.wavePeriod == wavePeriod &&
          other.waveDirection == waveDirection &&
          other.swellHeight == swellHeight &&
          other.swellPeriod == swellPeriod &&
          other.swellDirection == swellDirection &&
          other.windWaveHeight == windWaveHeight &&
          other.seaSurfaceTemp == seaSurfaceTemp &&
          other.currentSpeed == currentSpeed &&
          other.currentDirection == currentDirection &&
          other.timestamp == timestamp);

  @override
  int get hashCode => Object.hash(
        runtimeType,
        waveHeight,
        wavePeriod,
        waveDirection,
        swellHeight,
        swellPeriod,
        swellDirection,
        windWaveHeight,
        seaSurfaceTemp,
        currentSpeed,
        currentDirection,
        timestamp,
      );
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
