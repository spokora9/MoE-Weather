import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:moe_weather/api/api_client.dart';
import 'package:moe_weather/api/api_exception.dart';
import 'package:moe_weather/api/weather_api.dart';

import 'fixtures.dart';

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late WeatherApi api;
  late ApiClient client;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
    adapter = DioAdapter(dio: dio);
    client = createApiClient(
      'http://localhost:3000',
      dio: dio,
      requestIdGenerator: () => 'req',
    );
    api = WeatherApi(client);
  });

  test('getWeather parses a canonical /api/weather response', () async {
    adapter.onGet(
      '/api/weather',
      (server) => server.reply(200, sampleWeatherJson),
      queryParameters: const {
        'lat': 52.52,
        'lon': 13.41,
        'units': 'metric',
        'alerts': true,
      },
    );

    final res = await api.getWeather(
      lat: 52.52,
      lon: 13.41,
      units: 'metric',
      includeAlerts: true,
    );

    expect(res.location.name, 'Berlin');
    expect(res.current!.temperature, 12.5);
    expect(res.hourly, hasLength(1));
    expect(res.daily, hasLength(1));
    expect(res.alerts, hasLength(1));
    expect(res.units!.locale, 'metric');
  });

  test('throws ApiException on 4xx', () async {
    adapter.onGet(
      '/api/weather',
      (server) => server.reply(400, {
        'error': 'invalid_params',
        'message': 'Bad lat',
      }),
      queryParameters: const {'lat': 100, 'lon': 13.41},
    );

    expect(
      () => api.getWeather(lat: 100, lon: 13.41),
      throwsA(isA<ApiException>()
          .having((e) => e.statusCode, 'statusCode', 400)
          .having((e) => e.code, 'code', 'invalid_params')),
    );
  });
}
