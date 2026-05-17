import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:moe_weather/api/api_client.dart';
import 'package:moe_weather/api/auth_api.dart';

import 'fixtures.dart';

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late AuthApi api;
  late ApiClient client;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000'));
    adapter = DioAdapter(dio: dio);
    client = createApiClient(
      'http://localhost:3000',
      dio: dio,
      authToken: 'tok',
      requestIdGenerator: () => 'req',
    );
    api = AuthApi(client);
  });

  test('me() returns AuthUser with id/email/tier', () async {
    adapter.onGet(
      '/api/auth/me',
      (server) => server.reply(200, sampleAuthMeJson),
    );

    final user = await api.me();
    expect(user.id, 'user-123');
    expect(user.email, 'a@example.com');
    expect(user.tier, 'pro');
  });

  test('signOut clears cache after server call', () async {
    // Seed the cache.
    adapter.onGet(
      '/api/locations',
      (server) => server.reply(200, sampleLocationsJson),
    );
    await client.dio.get<dynamic>('/api/locations');

    adapter.onPost(
      '/api/auth/signout',
      (server) => server.reply(200, {'message': 'Signed out'}),
    );

    await api.signOut();
    // Next GET should NOT hit cache.
    expect(client.cache.length, 0);
  });

  test('signIn parses an AuthSession', () async {
    adapter.onPost(
      '/api/auth/signin',
      (server) => server.reply(200, {
        'accessToken': 'abc',
        'refreshToken': 'def',
        'user': sampleAuthMeJson,
      }),
      data: {'email': 'a@example.com', 'password': 'pw'},
    );

    final session = await api.signIn(email: 'a@example.com', password: 'pw');
    expect(session.accessToken, 'abc');
    expect(session.refreshToken, 'def');
    expect(session.user?.id, 'user-123');
  });

  test('signUp accepts snake_case backend reply', () async {
    adapter.onPost(
      '/api/auth/signup',
      (server) => server.reply(200, {
        'access_token': 'abc',
        'refresh_token': 'def',
        'expires_in': 3600,
        'token_type': 'bearer',
      }),
      data: {'email': 'a@example.com', 'password': 'pw'},
    );

    final session = await api.signUp(email: 'a@example.com', password: 'pw');
    expect(session.accessToken, 'abc');
    expect(session.expiresIn, 3600);
    expect(session.tokenType, 'bearer');
  });
}
