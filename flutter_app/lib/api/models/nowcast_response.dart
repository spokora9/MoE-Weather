/// `GET /api/nowcast` body. Shape defined inline in `src/routes/nowcast.ts` as
/// `NowcastResponseBody`.
///
/// Plain Dart class (no `freezed` codegen — see weather_response.dart for the
/// rationale).
class NowcastResponse {
  const NowcastResponse({
    required this.location,
    this.nowcast = const <NowcastEntry>[],
    this.unit = 'mm/h',
    required this.fetchedAt,
  });

  factory NowcastResponse.fromJson(Map<String, dynamic> json) =>
      NowcastResponse(
        location: NowcastLocation.fromJson(
          (json['location'] as Map).cast<String, dynamic>(),
        ),
        nowcast: (json['nowcast'] is List)
            ? (json['nowcast'] as List)
                .map((e) =>
                    NowcastEntry.fromJson((e as Map).cast<String, dynamic>()))
                .toList(growable: false)
            : const <NowcastEntry>[],
        unit: (json['unit'] as String?) ?? 'mm/h',
        fetchedAt: DateTime.parse(json['fetchedAt'] as String),
      );

  final NowcastLocation location;
  final List<NowcastEntry> nowcast;
  final String unit;
  final DateTime fetchedAt;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'location': location.toJson(),
        'nowcast': nowcast.map((e) => e.toJson()).toList(),
        'unit': unit,
        'fetchedAt': fetchedAt.toIso8601String(),
      };
}

class NowcastLocation {
  const NowcastLocation({required this.lat, required this.lon});

  factory NowcastLocation.fromJson(Map<String, dynamic> json) =>
      NowcastLocation(
        lat: (json['lat'] as num).toDouble(),
        lon: (json['lon'] as num).toDouble(),
      );

  final double lat;
  final double lon;

  Map<String, dynamic> toJson() =>
      <String, dynamic>{'lat': lat, 'lon': lon};

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is NowcastLocation && other.lat == lat && other.lon == lon);

  @override
  int get hashCode => Object.hash(runtimeType, lat, lon);
}

class NowcastEntry {
  const NowcastEntry({
    required this.time,
    required this.precipitationIntensity,
    required this.precipitationProbability,
  });

  factory NowcastEntry.fromJson(Map<String, dynamic> json) => NowcastEntry(
        time: json['time'] as String,
        precipitationIntensity:
            (json['precipitationIntensity'] as num).toDouble(),
        precipitationProbability:
            (json['precipitationProbability'] as num).toDouble(),
      );

  final String time;
  final double precipitationIntensity;
  final double precipitationProbability;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'time': time,
        'precipitationIntensity': precipitationIntensity,
        'precipitationProbability': precipitationProbability,
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is NowcastEntry &&
          other.time == time &&
          other.precipitationIntensity == precipitationIntensity &&
          other.precipitationProbability == precipitationProbability);

  @override
  int get hashCode => Object.hash(
      runtimeType, time, precipitationIntensity, precipitationProbability);
}
