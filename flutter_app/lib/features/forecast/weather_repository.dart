import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:moe_weather/api/api_client.dart';
import 'package:moe_weather/api/api_exception.dart';
import 'package:moe_weather/api/models/weather_response.dart';

class WeatherRepository {
  WeatherRepository(this._client);
  final ApiClient _client;

  Future<WeatherResponse> getWeather(double lat, double lon) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/api/weather',
        queryParameters: {'lat': lat, 'lon': lon, 'hours': 48, 'days': 7},
      );
      return WeatherResponse.fromJson(response.data!);
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }
}

final weatherRepositoryProvider = Provider<WeatherRepository>(
  (ref) => WeatherRepository(ref.watch(apiClientProvider)),
);
