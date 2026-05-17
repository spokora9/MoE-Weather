import 'api_client.dart';
import 'models/nowcast_response.dart';

/// Typed wrapper around `GET /api/nowcast`.
///
/// Returns 402 with `error: 'upgrade_required'` for non-Pro callers — the
/// generic [ApiException] surfaces this via `isUpgradeRequired`.
class NowcastApi {
  NowcastApi(this._client);

  final ApiClient _client;

  Future<NowcastResponse> getNowcast({
    required double lat,
    required double lon,
  }) async {
    try {
      final response = await _client.dio.get<dynamic>(
        '/api/nowcast',
        queryParameters: <String, dynamic>{'lat': lat, 'lon': lon},
      );
      return NowcastResponse.fromJson(
        (response.data as Map).cast<String, dynamic>(),
      );
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }
}
