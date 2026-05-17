import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:moe_weather/api/api_client.dart';
import 'package:moe_weather/api/api_exception.dart';
import 'package:moe_weather/api/locations_api.dart';
import 'package:moe_weather/api/models/saved_location.dart';

import 'fixtures.dart';

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late LocationsApi api;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
    adapter = DioAdapter(dio: dio);
    final client = createApiClient(
      'http://localhost:3000',
      dio: dio,
      authToken: 'tok',
      requestIdGenerator: () => 'req',
    );
    api = LocationsApi(client);
  });

  test('list parses an array of SavedLocation', () async {
    adapter.onGet(
      '/api/locations',
      (server) => server.reply(200, sampleLocationsJson),
    );

    final rows = await api.list();
    expect(rows, hasLength(1));
    expect(rows.first.name, 'Home');
    expect(rows.first.isDefault, isTrue);
    expect(rows.first.country, 'DE');
  });

  test('create posts the payload and parses the row', () async {
    adapter.onPost(
      '/api/locations',
      (server) => server.reply(201, sampleLocationJson),
      data: {
        'name': 'Home',
        'latitude': 52.52,
        'longitude': 13.41,
        'country': 'DE',
        'is_default': true,
      },
    );

    final row = await api.create(const SavedLocationInput(
      name: 'Home',
      latitude: 52.52,
      longitude: 13.41,
      country: 'DE',
      isDefault: true,
    ));
    expect(row.id, 'loc-1');
  });

  test('create surfaces 402 upgrade_required for free tier', () async {
    adapter.onPost(
      '/api/locations',
      (server) => server.reply(402, {
        'error': 'Free tier limit reached',
        'message': 'Upgrade to Pro for unlimited saved locations',
        'upgradeUrl': '/upgrade',
      }),
      data: {
        'name': 'Home',
        'latitude': 1.0,
        'longitude': 2.0,
        'is_default': false,
      },
    );

    expect(
      () => api.create(const SavedLocationInput(
        name: 'Home',
        latitude: 1.0,
        longitude: 2.0,
      )),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 's', 402)),
    );
  });

  test('delete sends DELETE and returns void', () async {
    adapter.onDelete(
      '/api/locations/loc-1',
      (server) => server.reply(204, null),
    );

    await api.delete('loc-1');
  });

  test('patch sends PATCH with body', () async {
    adapter.onPatch(
      '/api/locations/loc-1',
      (server) => server.reply(200, sampleLocationJson),
      data: {'name': 'New name'},
    );

    final row = await api.patch('loc-1', name: 'New name');
    expect(row.id, 'loc-1');
  });
}
