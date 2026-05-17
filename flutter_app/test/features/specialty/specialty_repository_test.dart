import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:moe_weather/api/api_client.dart';
import 'package:moe_weather/api/api_exception.dart';
import 'package:moe_weather/features/specialty/air_quality_model.dart';
import 'package:moe_weather/features/specialty/marine_model.dart';
import 'package:moe_weather/features/specialty/specialty_repository.dart';

const _baseUrl = 'http://localhost:3000';

const _aqJson = <String, dynamic>{
  'aqi': 42,
  'category': 'Good',
  'pm25': 10.5,
  'pm10': 20.0,
  'o3': 33.1,
  'no2': 5.2,
  'co': 0.4,
  'so2': 1.1,
  'timestamp': '2026-05-17T12:00:00.000Z',
};

const _marineJson = <String, dynamic>{
  'waveHeight': 1.2,
  'wavePeriod': 8.5,
  'waveDirection': 270.0,
  'swellHeight': 0.9,
  'swellPeriod': 10.0,
  'swellDirection': 260.0,
  'windWaveHeight': 0.4,
  'seaSurfaceTemp': 16.3,
  'currentSpeed': 0.2,
  'currentDirection': 180.0,
  'timestamp': '2026-05-17T12:00:00.000Z',
};

({ApiClient client, DioAdapter adapter, SpecialtyRepository repo}) _build() {
  final dio = Dio(BaseOptions(baseUrl: _baseUrl));
  final adapter = DioAdapter(dio: dio);
  final client = createApiClient(
    _baseUrl,
    dio: dio,
    requestIdGenerator: () => 'test-req-id',
    retryDelays: const [Duration.zero, Duration.zero],
  );
  final repo = SpecialtyRepository(client);
  return (client: client, adapter: adapter, repo: repo);
}

void main() {
  group('SpecialtyRepository', () {
    test('getAirQuality returns AirQualityResponse on 200', () async {
      final ctx = _build();
      ctx.adapter.onGet(
        '/api/air-quality',
        (server) => server.reply(200, _aqJson),
        queryParameters: const {'lat': 51.5, 'lon': -0.12},
      );

      final result = await ctx.repo.getAirQuality(51.5, -0.12);

      expect(result, isA<AirQualityResponse>());
      expect(result.aqi, 42);
      expect(result.category, 'Good');
      expect(result.pm25, 10.5);
      expect(result.pm10, 20.0);
      expect(result.o3, 33.1);
      expect(result.no2, 5.2);
      expect(result.co, 0.4);
      expect(result.so2, 1.1);
    });

    test('getAirQuality throws ApiException on 503', () async {
      final ctx = _build();
      // Register enough times to cover retry attempts.
      for (var i = 0; i < 3; i++) {
        ctx.adapter.onGet(
          '/api/air-quality',
          (server) => server.reply(503, {'error': 'unavailable'}),
          queryParameters: const {'lat': 51.5, 'lon': -0.12},
        );
      }

      await expectLater(
        () => ctx.repo.getAirQuality(51.5, -0.12),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 503)),
      );
    });

    test('getMarine returns MarineResponse on 200', () async {
      final ctx = _build();
      ctx.adapter.onGet(
        '/api/marine',
        (server) => server.reply(200, _marineJson),
        queryParameters: const {'lat': 51.5, 'lon': -0.12},
      );

      final result = await ctx.repo.getMarine(51.5, -0.12);

      expect(result, isA<MarineResponse>());
      expect(result.waveHeight, 1.2);
      expect(result.wavePeriod, 8.5);
      expect(result.waveDirection, 270.0);
      expect(result.swellHeight, 0.9);
      expect(result.swellPeriod, 10.0);
      expect(result.swellDirection, 260.0);
      expect(result.windWaveHeight, 0.4);
      expect(result.seaSurfaceTemp, 16.3);
      expect(result.currentSpeed, 0.2);
      expect(result.currentDirection, 180.0);
    });
  });
}
