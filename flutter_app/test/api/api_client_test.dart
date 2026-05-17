import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:moe_weather/api/api_client.dart';
import 'package:moe_weather/api/api_exception.dart';
import 'package:moe_weather/api/models/api_error.dart';

const _baseUrl = 'http://localhost:3000';
const _fixedRequestId = '00000000-0000-4000-8000-000000000000';

({ApiClient client, DioAdapter adapter}) _buildClient({
  String? token,
  ResponseCache? cache,
}) {
  final dio = Dio(BaseOptions(baseUrl: _baseUrl));
  final adapter = DioAdapter(dio: dio);
  final client = createApiClient(
    _baseUrl,
    dio: dio,
    authToken: token,
    cache: cache,
    requestIdGenerator: () => _fixedRequestId,
    // Fast retries in tests so the suite runs in <1s.
    retryDelays: const [Duration.zero, Duration.zero],
  );
  return (client: client, adapter: adapter);
}

void main() {
  group('Auth + request-ID interceptor', () {
    test('injects Authorization: Bearer when token supplied', () async {
      final ctx = _buildClient(token: 'abc123');
      ctx.adapter.onGet(
        '/api/health',
        (server) => server.reply(200, {'ok': true}),
      );

      final res = await ctx.client.dio.get<dynamic>('/api/health');
      expect(res.statusCode, 200);
      expect(res.requestOptions.headers['Authorization'], 'Bearer abc123');
    });

    test('omits Authorization when no token', () async {
      final ctx = _buildClient();
      ctx.adapter.onGet(
        '/api/health',
        (server) => server.reply(200, {'ok': true}),
      );

      final res = await ctx.client.dio.get<dynamic>('/api/health');
      expect(res.statusCode, 200);
      expect(res.requestOptions.headers.containsKey('Authorization'), isFalse);
    });

    test('always sets X-Request-ID', () async {
      final ctx = _buildClient();
      ctx.adapter.onGet(
        '/api/health',
        (server) => server.reply(200, {'ok': true}),
      );
      final res = await ctx.client.dio.get<dynamic>('/api/health');
      expect(res.requestOptions.headers['X-Request-ID'], _fixedRequestId);
    });

    test('authToken setter affects subsequent requests', () async {
      final ctx = _buildClient();
      ctx.adapter.onGet(
        '/api/health',
        (server) => server.reply(200, {'ok': true}),
      );
      ctx.client.authToken = 'new-token';
      final res = await ctx.client.dio.get<dynamic>('/api/health');
      expect(res.requestOptions.headers['Authorization'], 'Bearer new-token');
    });
  });

  group('Retry interceptor', () {
    test('retries idempotent GET on 5xx up to 2 times', () async {
      final ctx = _buildClient();
      ctx.adapter.onGet(
        '/api/weather',
        (server) => server
          ..reply(502, {'error': 'bad_gateway'})
          ..reply(502, {'error': 'bad_gateway'})
          ..reply(200, {'ok': true}),
        queryParameters: const {'lat': 1, 'lon': 2},
      );

      final res = await ctx.client.dio.get<dynamic>(
        '/api/weather',
        queryParameters: const {'lat': 1, 'lon': 2},
      );
      expect(res.statusCode, 200);
    });

    test('does not retry 4xx — surfaces error immediately', () async {
      final ctx = _buildClient();
      ctx.adapter.onGet(
        '/api/weather',
        (server) => server.reply(400, {'error': 'invalid_params'}),
      );

      expect(
        () => ctx.client.dio.get<dynamic>('/api/weather'),
        throwsA(isA<DioException>()),
      );
    });

    test('gives up after exhausting retries', () async {
      final ctx = _buildClient();
      ctx.adapter.onGet(
        '/api/weather',
        (server) => server
          ..reply(503, {'error': 'service_unavailable'})
          ..reply(503, {'error': 'service_unavailable'})
          ..reply(503, {'error': 'service_unavailable'})
          ..reply(503, {'error': 'service_unavailable'}),
      );

      DioException? captured;
      try {
        await ctx.client.dio.get<dynamic>('/api/weather');
      } on DioException catch (e) {
        captured = e;
      }
      expect(captured, isNotNull);
      expect(captured!.response?.statusCode, 503);
    });
  });

  group('Cache interceptor', () {
    test('cache miss → network, cache hit → in-memory replay', () async {
      final cache = ResponseCache();
      final ctx = _buildClient(cache: cache);

      ctx.adapter.onGet(
        '/api/weather',
        (server) => server.reply(200, {'value': 1}),
        queryParameters: const {'lat': 1, 'lon': 2},
      );

      final first = await ctx.client.dio.get<dynamic>(
        '/api/weather',
        queryParameters: const {'lat': 1, 'lon': 2},
      );
      final second = await ctx.client.dio.get<dynamic>(
        '/api/weather',
        queryParameters: const {'lat': 1, 'lon': 2},
      );

      expect(first.extra[kCacheHitKey], isNot(true));
      expect(second.extra[kCacheHitKey], isTrue);
      expect(second.data, {'value': 1});
    });

    test('manual invalidateCache forces refetch', () async {
      final ctx = _buildClient();

      ctx.adapter.onGet(
        '/api/weather',
        (server) => server
          ..reply(200, {'value': 1})
          ..reply(200, {'value': 2}),
      );

      final first = await ctx.client.dio.get<dynamic>('/api/weather');
      ctx.client.invalidateCache();
      final second = await ctx.client.dio.get<dynamic>('/api/weather');

      expect(first.data, {'value': 1});
      expect(second.data, {'value': 2});
    });

    test('different query strings get different cache slots', () async {
      final ctx = _buildClient();

      ctx.adapter.onGet(
        '/api/weather',
        (server) => server.reply(200, {'q': 'a'}),
        queryParameters: const {'lat': 1, 'lon': 2},
      );
      ctx.adapter.onGet(
        '/api/weather',
        (server) => server.reply(200, {'q': 'b'}),
        queryParameters: const {'lat': 3, 'lon': 4},
      );

      final a = await ctx.client.dio.get<dynamic>(
        '/api/weather',
        queryParameters: const {'lat': 1, 'lon': 2},
      );
      final b = await ctx.client.dio.get<dynamic>(
        '/api/weather',
        queryParameters: const {'lat': 3, 'lon': 4},
      );

      expect(a.data, {'q': 'a'});
      expect(b.data, {'q': 'b'});
    });

    test('POST is never cached', () async {
      final ctx = _buildClient(token: 'tok');

      ctx.adapter.onPost(
        '/api/locations',
        (server) => server
          ..reply(200, {'first': true})
          ..reply(200, {'second': true}),
        data: {'name': 'x'},
      );

      final first = await ctx.client.dio.post<dynamic>(
        '/api/locations',
        data: {'name': 'x'},
      );
      final second = await ctx.client.dio.post<dynamic>(
        '/api/locations',
        data: {'name': 'x'},
      );

      expect(first.data, {'first': true});
      expect(second.data, {'second': true});
    });

    test('skipCache extra opts out of the cache', () async {
      final ctx = _buildClient();
      ctx.adapter.onGet(
        '/api/weather',
        (server) => server
          ..reply(200, {'v': 1})
          ..reply(200, {'v': 2}),
      );

      final first = await ctx.client.dio.get<dynamic>(
        '/api/weather',
        options: Options(extra: const {kSkipCacheKey: true}),
      );
      final second = await ctx.client.dio.get<dynamic>(
        '/api/weather',
        options: Options(extra: const {kSkipCacheKey: true}),
      );

      expect(first.data, {'v': 1});
      expect(second.data, {'v': 2});
    });
  });

  group('toApiException', () {
    test('parses ApiError JSON from response body', () {
      final original = DioException(
        requestOptions: RequestOptions(path: '/x'),
        response: Response<dynamic>(
          requestOptions: RequestOptions(path: '/x'),
          statusCode: 402,
          data: {
            'error': 'upgrade_required',
            'message': 'Pro only',
            'upgradeUrl': '/upgrade',
          },
        ),
      );
      final ex = toApiException(original);
      expect(ex.statusCode, 402);
      expect(ex.code, 'upgrade_required');
      expect(ex.error.upgradeUrl, '/upgrade');
      expect(ex.isUpgradeRequired, isTrue);
    });

    test('wraps network errors into a synthetic ApiError', () {
      final original = DioException(
        requestOptions: RequestOptions(path: '/x'),
        type: DioExceptionType.connectionError,
        error: 'boom',
      );
      final ex = toApiException(original);
      expect(ex.statusCode, isNull);
      expect(ex.code, 'connection_error');
    });

    test('ApiException returned unchanged when already typed', () {
      final original =
          ApiException(error: const ApiError(error: 'x'), statusCode: 500);
      expect(toApiException(original), same(original));
    });

    test('plain object → unknown_error envelope', () {
      final ex = toApiException(Exception('boom'));
      expect(ex.code, 'unknown_error');
    });
  });

  group('ResponseCache TTL', () {
    test('returns null for expired entries', () {
      var now = DateTime(2024, 1, 1, 12);
      final cache = ResponseCache(
        ttl: const Duration(minutes: 5),
        now: () => now,
      );
      cache.set('k', 'v');
      now = now.add(const Duration(minutes: 6));
      expect(cache.get('k'), isNull);
    });

    test('clear empties the store', () {
      final cache = ResponseCache();
      cache.set('a', 1);
      cache.set('b', 2);
      expect(cache.length, 2);
      cache.clear();
      expect(cache.length, 0);
    });

    test('remove evicts a single entry', () {
      final cache = ResponseCache();
      cache.set('a', 1);
      cache.set('b', 2);
      cache.remove('a');
      expect(cache.get('a'), isNull);
      expect(cache.get('b'), 2);
    });
  });
}
