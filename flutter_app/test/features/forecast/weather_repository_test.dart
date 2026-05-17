import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:moe_weather/api/api_client.dart';
import 'package:moe_weather/api/api_exception.dart';
import 'package:moe_weather/features/forecast/weather_repository.dart';

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late WeatherRepository repo;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'http://test'));
    adapter = DioAdapter(dio: dio);
    final client = ApiClient(dio: dio, cache: ResponseCache());
    repo = WeatherRepository(client);
  });

  group('WeatherRepository', () {
    test('getWeather returns WeatherResponse on 200', () async {
      adapter.onGet(
        '/api/weather',
        (server) => server.reply(200, _mockWeatherJson),
        queryParameters: {'lat': 51.5, 'lon': -0.12, 'hours': 48, 'days': 7},
      );
      final result = await repo.getWeather(51.5, -0.12);
      expect(result.location.name, 'London');
    });

    test('getWeather throws ApiException on 404', () async {
      adapter.onGet(
        '/api/weather',
        (server) => server.reply(404, {'error': 'not_found'}),
        queryParameters: {'lat': 0.0, 'lon': 0.0, 'hours': 48, 'days': 7},
      );
      expect(() => repo.getWeather(0, 0), throwsA(isA<ApiException>()));
    });

    test('getWeather throws ApiException on network error', () async {
      adapter.onGet(
        '/api/weather',
        (server) => server.throws(
          500,
          DioException(
            requestOptions: RequestOptions(path: '/api/weather'),
            type: DioExceptionType.connectionError,
          ),
        ),
        queryParameters: {'lat': 0.0, 'lon': 0.0, 'hours': 48, 'days': 7},
      );
      expect(() => repo.getWeather(0, 0), throwsA(isA<ApiException>()));
    });
  });
}

const _mockWeatherJson = {
  'location': {
    'name': 'London',
    'country': 'GB',
    'coordinates': {'latitude': 51.5, 'longitude': -0.12},
  },
  'current': {
    'temperature': 18.0,
    'feelsLike': 17.0,
    'humidity': 65.0,
    'pressure': 1013.0,
    'windSpeed': 12.0,
    'windDirection': 270.0,
    'visibility': 10000.0,
    'cloudCover': 40.0,
    'weatherCode': 2,
    'weatherDescription': 'Partly cloudy',
    'timestamp': '2024-01-15T12:00:00Z',
  },
  'hourly': <dynamic>[],
  'daily': <dynamic>[],
  'alerts': <dynamic>[],
};
