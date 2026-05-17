import 'api_client.dart';
import 'models/saved_location.dart';

/// Typed wrapper around the `/api/locations` CRUD endpoints.
class LocationsApi {
  LocationsApi(this._client);

  final ApiClient _client;

  /// `GET /api/locations` — list the authenticated user's saved locations.
  Future<List<SavedLocation>> list() async {
    try {
      final response = await _client.dio.get<dynamic>('/api/locations');
      final data = response.data;
      if (data is! List) return <SavedLocation>[];
      return data
          .map((item) =>
              SavedLocation.fromJson((item as Map).cast<String, dynamic>()))
          .toList();
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }

  /// `POST /api/locations` — create a new saved location. Returns 402 for
  /// free-tier users who exceed the saved-location limit.
  Future<SavedLocation> create(SavedLocationInput input) async {
    try {
      final response = await _client.dio.post<dynamic>(
        '/api/locations',
        data: input.toJson(),
      );
      // Cached list is now stale.
      _client.invalidate('/api/locations');
      return SavedLocation.fromJson(
        (response.data as Map).cast<String, dynamic>(),
      );
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }

  /// `DELETE /api/locations/:id` — returns 204 on success.
  Future<void> delete(String id) async {
    try {
      await _client.dio.delete<dynamic>('/api/locations/$id');
      _client.invalidate('/api/locations');
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }

  /// `PATCH /api/locations/:id` — bonus endpoint exposed by the backend; lets
  /// callers rename a location, flip `is_default`, or reorder.
  Future<SavedLocation> patch(
    String id, {
    String? name,
    bool? isDefault,
    int? displayOrder,
  }) async {
    final body = <String, dynamic>{
      if (name != null) 'name': name,
      if (isDefault != null) 'is_default': isDefault,
      if (displayOrder != null) 'display_order': displayOrder,
    };
    try {
      final response = await _client.dio.patch<dynamic>(
        '/api/locations/$id',
        data: body,
      );
      _client.invalidate('/api/locations');
      return SavedLocation.fromJson(
        (response.data as Map).cast<String, dynamic>(),
      );
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }
}
