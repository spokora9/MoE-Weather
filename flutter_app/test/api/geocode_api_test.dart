import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:moe_weather/api/api_client.dart';
import 'package:moe_weather/api/geocode_api.dart';

import 'fixtures.dart';

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late GeocodeApi api;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
    adapter = DioAdapter(dio: dio);
    final client = createApiClient(
      'http://localhost:3000',
      dio: dio,
      requestIdGenerator: () => 'req',
    );
    api = GeocodeApi(client);
  });

  test('search parses a list of geocode results', () async {
    adapter.onGet(
      '/api/geocode',
      (server) => server.reply(200, sampleGeocodeJson),
      queryParameters: const {'q': 'Berlin', 'lang': 'en'},
    );

    final res = await api.search('Berlin', lang: 'en');
    expect(res, hasLength(2));
    expect(res.first.name, 'Berlin');
    expect(res.first.country, 'DE');
    expect(res.first.population, 3645000);
  });

  test('returns empty list when server returns []', () async {
    adapter.onGet(
      '/api/geocode',
      (server) => server.reply(200, <dynamic>[]),
      queryParameters: const {'q': 'asdf'},
    );
    expect(await api.search('asdf'), isEmpty);
  });
}
