import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:moe_weather/api/api_client.dart';
import 'package:moe_weather/api/api_exception.dart';

import 'air_quality_model.dart';
import 'marine_model.dart';

class SpecialtyRepository {
  SpecialtyRepository(this._client);
  final ApiClient _client;

  Future<AirQualityResponse> getAirQuality(double lat, double lon) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/api/air-quality',
        queryParameters: {'lat': lat, 'lon': lon},
      );
      return AirQualityResponse.fromJson(response.data!);
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }

  Future<MarineResponse> getMarine(double lat, double lon) async {
    try {
      final response = await _client.dio.get<Map<String, dynamic>>(
        '/api/marine',
        queryParameters: {'lat': lat, 'lon': lon},
      );
      return MarineResponse.fromJson(response.data!);
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }
}

final specialtyRepositoryProvider = Provider<SpecialtyRepository>(
  (ref) => SpecialtyRepository(ref.watch(apiClientProvider)),
);
