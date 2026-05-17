import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:moe_weather/api/api_client.dart';
import 'package:moe_weather/api/models/saved_location.dart';

class LocationsRepository {
  LocationsRepository(this._client);
  final ApiClient _client;

  Future<List<SavedLocation>> getLocations() async {
    final response = await _client.dio.get<List<dynamic>>('/api/locations');
    return (response.data ?? [])
        .map((e) => SavedLocation.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<SavedLocation> addLocation(SavedLocationInput input) async {
    final response = await _client.dio.post<Map<String, dynamic>>(
      '/api/locations',
      data: input.toJson(),
    );
    return SavedLocation.fromJson(response.data!);
  }

  Future<void> deleteLocation(String id) async {
    await _client.dio.delete<void>('/api/locations/$id');
  }

  Future<SavedLocation> setDefault(String id) async {
    final response = await _client.dio.patch<Map<String, dynamic>>(
      '/api/locations/$id',
      data: <String, dynamic>{'is_default': true},
    );
    return SavedLocation.fromJson(response.data!);
  }
}

final locationsRepositoryProvider = Provider<LocationsRepository>(
  (ref) => LocationsRepository(ref.watch(apiClientProvider)),
);
