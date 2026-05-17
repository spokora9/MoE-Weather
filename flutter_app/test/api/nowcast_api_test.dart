import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:moe_weather/api/api_client.dart';
import 'package:moe_weather/api/api_exception.dart';
import 'package:moe_weather/api/nowcast_api.dart';

import 'fixtures.dart';

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late NowcastApi api;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
    adapter = DioAdapter(dio: dio);
    final client = createApiClient(
      'http://localhost:3000',
      dio: dio,
      requestIdGenerator: () => 'req',
    );
    api = NowcastApi(client);
  });

  test('getNowcast parses the response body', () async {
    adapter.onGet(
      '/api/nowcast',
      (server) => server.reply(200, sampleNowcastJson),
      queryParameters: const {'lat': 52.52, 'lon': 13.41},
    );

    final res = await api.getNowcast(lat: 52.52, lon: 13.41);
    expect(res.nowcast, hasLength(2));
    expect(res.unit, 'mm/h');
    expect(res.location.lat, 52.52);
  });

  test('402 surfaces as ApiException.isUpgradeRequired', () async {
    adapter.onGet(
      '/api/nowcast',
      (server) => server.reply(402, {
        'error': 'upgrade_required',
        'message': 'Pro only',
        'upgradeUrl': '/upgrade',
      }),
      queryParameters: const {'lat': 1, 'lon': 1},
    );

    ApiException? captured;
    try {
      await api.getNowcast(lat: 1, lon: 1);
    } on ApiException catch (e) {
      captured = e;
    }
    expect(captured, isNotNull);
    expect(captured!.isUpgradeRequired, isTrue);
    expect(captured.error.upgradeUrl, '/upgrade');
  });
}
