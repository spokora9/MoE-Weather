import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:moe_weather/api/api_client.dart';
import 'package:moe_weather/api/models/push_subscription.dart';
import 'package:moe_weather/api/notifications_api.dart';

import 'fixtures.dart';

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late NotificationsApi api;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
    adapter = DioAdapter(dio: dio);
    final client = createApiClient(
      'http://localhost:3000',
      dio: dio,
      authToken: 'tok',
      requestIdGenerator: () => 'req',
    );
    api = NotificationsApi(client);
  });

  test('getVapidPublicKey returns the key string', () async {
    adapter.onGet(
      '/api/notifications/vapid-public-key',
      (server) => server.reply(200, sampleVapidJson),
    );
    expect(await api.getVapidPublicKey(), 'BPxxx-vapid-public-key');
  });

  test('subscribe posts the W3C shape and parses the record', () async {
    adapter.onPost(
      '/api/notifications/subscribe',
      (server) => server.reply(201, samplePushSubscriptionJson),
      data: {
        'endpoint': 'https://example.com/push/endpoint',
        'keys': {'p256dh': 'p256', 'auth': 'auth-token'},
      },
    );

    final res = await api.subscribe(const PushSubscriptionInput(
      endpoint: 'https://example.com/push/endpoint',
      keys: PushSubscriptionKeys(p256dh: 'p256', auth: 'auth-token'),
    ));
    expect(res.id, 'sub-1');
    expect(res.endpoint, 'https://example.com/push/endpoint');
  });

  test('unsubscribe sends DELETE with endpoint body', () async {
    adapter.onDelete(
      '/api/notifications/unsubscribe',
      (server) => server.reply(204, null),
      data: {'endpoint': 'https://example.com/push/endpoint'},
    );

    await api.unsubscribe('https://example.com/push/endpoint');
  });

  test('test() parses sent/failed/total', () async {
    adapter.onPost(
      '/api/notifications/test',
      (server) => server.reply(200, samplePushTestJson),
    );
    final res = await api.test();
    expect(res.sent, 1);
    expect(res.failed, 0);
    expect(res.total, 1);
  });
}
