import 'api_client.dart';
import 'models/push_subscription.dart';

/// Typed wrapper around the `/api/notifications/*` endpoints.
class NotificationsApi {
  NotificationsApi(this._client);

  final ApiClient _client;

  /// `GET /api/notifications/vapid-public-key` — public, no auth required.
  Future<String> getVapidPublicKey() async {
    try {
      final response =
          await _client.dio.get<dynamic>('/api/notifications/vapid-public-key');
      return VapidPublicKey.fromJson(
        (response.data as Map).cast<String, dynamic>(),
      ).publicKey;
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }

  /// `POST /api/notifications/subscribe` — upserts a Web Push subscription.
  Future<PushSubscriptionRecord> subscribe(
      PushSubscriptionInput input) async {
    try {
      final response = await _client.dio.post<dynamic>(
        '/api/notifications/subscribe',
        data: input.toJson(),
      );
      return PushSubscriptionRecord.fromJson(
        (response.data as Map).cast<String, dynamic>(),
      );
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }

  /// `DELETE /api/notifications/unsubscribe` — removes by endpoint. Returns
  /// 204 on success.
  Future<void> unsubscribe(String endpoint) async {
    try {
      await _client.dio.delete<dynamic>(
        '/api/notifications/unsubscribe',
        data: <String, dynamic>{'endpoint': endpoint},
      );
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }

  /// `POST /api/notifications/test` — sends a push to every subscription on
  /// the authenticated user, returning the send/fail count.
  Future<PushTestResult> test() async {
    try {
      final response =
          await _client.dio.post<dynamic>('/api/notifications/test');
      return PushTestResult.fromJson(
        (response.data as Map).cast<String, dynamic>(),
      );
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }
}
