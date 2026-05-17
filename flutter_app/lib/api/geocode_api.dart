import 'api_client.dart';
import 'models/geocode_result.dart';

/// Typed wrapper around `GET /api/geocode`.
class GeocodeApi {
  GeocodeApi(this._client);

  final ApiClient _client;

  /// Resolves a city/place name to a list of [GeocodeResult]s.
  Future<List<GeocodeResult>> search(String query, {String? lang}) async {
    try {
      final response = await _client.dio.get<dynamic>(
        '/api/geocode',
        queryParameters: <String, dynamic>{
          'q': query,
          if (lang != null) 'lang': lang,
        },
      );
      final data = response.data;
      if (data is! List) return <GeocodeResult>[];
      return data
          .map((item) =>
              GeocodeResult.fromJson((item as Map).cast<String, dynamic>()))
          .toList();
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }
}
