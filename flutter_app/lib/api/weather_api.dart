import 'package:dio/dio.dart';

import 'api_client.dart';
import 'models/weather_response.dart';

/// Typed wrapper around `GET /api/weather`.
class WeatherApi {
  WeatherApi(this._client);

  final ApiClient _client;

  /// Fetches the canonical current + hourly + daily forecast for a coordinate.
  ///
  /// `units` accepts `metric|imperial|uk|canada|auto` (server-validated).
  /// `lang` is forwarded as an `Accept-Language` header so geocoding-style
  /// localisation downstream can pick it up.
  Future<WeatherResponse> getWeather({
    required double lat,
    required double lon,
    String? units,
    String? lang,
    bool? includeAlerts,
    int? hourly,
    int? daily,
  }) async {
    final query = <String, dynamic>{
      'lat': lat,
      'lon': lon,
      if (units != null) 'units': units,
      if (includeAlerts != null) 'alerts': includeAlerts,
      if (hourly != null) 'hourly': hourly,
      if (daily != null) 'daily': daily,
    };
    try {
      final response = await _client.dio.get<dynamic>(
        '/api/weather',
        queryParameters: query,
        options: lang != null
            ? Options(headers: <String, dynamic>{'Accept-Language': lang})
            : null,
      );
      return WeatherResponse.fromJson(
        (response.data as Map).cast<String, dynamic>(),
      );
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }
}
