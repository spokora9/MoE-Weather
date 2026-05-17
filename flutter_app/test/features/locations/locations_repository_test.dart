import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:moe_weather/api/api_client.dart';
import 'package:moe_weather/api/models/saved_location.dart';
import 'package:moe_weather/features/locations/locations_repository.dart';

void main() {
  late Dio dio;
  late DioAdapter dioAdapter;
  late LocationsRepository repo;

  const _baseUrl = 'http://localhost:3000';

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: _baseUrl));
    dioAdapter = DioAdapter(dio: dio);
    final client = ApiClient(
      dio: dio,
      cache: ResponseCache(ttl: Duration.zero),
    );
    repo = LocationsRepository(client);
  });

  group('LocationsRepository', () {
    test('getLocations returns list on 200', () async {
      dioAdapter.onGet(
        '/api/locations',
        (server) => server.reply(200, [
          {
            'id': 'loc1',
            'user_id': 'u1',
            'name': 'London',
            'latitude': 51.5,
            'longitude': -0.12,
            'is_default': false,
          }
        ]),
      );

      final locations = await repo.getLocations();

      expect(locations, hasLength(1));
      expect(locations.first.id, 'loc1');
      expect(locations.first.name, 'London');
      expect(locations.first.latitude, 51.5);
      expect(locations.first.longitude, -0.12);
      expect(locations.first.isDefault, isFalse);
    });

    test('addLocation posts body and returns location', () async {
      const input = SavedLocationInput(
        name: 'Paris',
        latitude: 48.85,
        longitude: 2.35,
        country: 'France',
      );
      final responseJson = {
        'id': 'loc2',
        'user_id': 'u1',
        'name': 'Paris',
        'latitude': 48.85,
        'longitude': 2.35,
        'country': 'France',
        'is_default': false,
      };

      dioAdapter.onPost(
        '/api/locations',
        (server) => server.reply(201, responseJson),
        data: input.toJson(),
      );

      final location = await repo.addLocation(input);

      expect(location.id, 'loc2');
      expect(location.name, 'Paris');
      expect(location.country, 'France');
    });

    test('deleteLocation sends DELETE to /api/locations/loc1', () async {
      dioAdapter.onDelete(
        '/api/locations/loc1',
        (server) => server.reply(204, null),
      );

      // Should complete without throwing
      await expectLater(repo.deleteLocation('loc1'), completes);
    });

    test('setDefault sends PATCH to /api/locations/loc1', () async {
      final updatedJson = {
        'id': 'loc1',
        'user_id': 'u1',
        'name': 'London',
        'latitude': 51.5,
        'longitude': -0.12,
        'is_default': true,
      };

      dioAdapter.onPatch(
        '/api/locations/loc1',
        (server) => server.reply(200, updatedJson),
        data: {'is_default': true},
      );

      final updated = await repo.setDefault('loc1');

      expect(updated.id, 'loc1');
      expect(updated.isDefault, isTrue);
    });
  });
}
