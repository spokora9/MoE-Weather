/// One entry from `GET /api/geocode`. Matches `GeocodingResult` in
/// `src/types/weather.ts`.
class GeocodeResult {
  const GeocodeResult({
    required this.name,
    required this.country,
    this.state,
    required this.latitude,
    required this.longitude,
    this.population,
  });

  factory GeocodeResult.fromJson(Map<String, dynamic> json) => GeocodeResult(
        name: json['name'] as String,
        country: json['country'] as String,
        state: json['state'] as String?,
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        population: (json['population'] as num?)?.toInt(),
      );

  final String name;
  final String country;
  final String? state;
  final double latitude;
  final double longitude;
  final int? population;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'name': name,
        'country': country,
        if (state != null) 'state': state,
        'latitude': latitude,
        'longitude': longitude,
        if (population != null) 'population': population,
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is GeocodeResult &&
          other.name == name &&
          other.country == country &&
          other.state == state &&
          other.latitude == latitude &&
          other.longitude == longitude &&
          other.population == population);

  @override
  int get hashCode => Object.hash(
      runtimeType, name, country, state, latitude, longitude, population);
}
