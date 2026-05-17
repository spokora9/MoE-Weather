import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import 'api_exception.dart';
import 'models/api_error.dart';

/// Generator for the per-request `X-Request-ID` header. Tests inject a
/// deterministic version; production uses [const Uuid().v4].
typedef RequestIdGenerator = String Function();

String _defaultRequestId() => const Uuid().v4();

/// Default base URL used when the app is not given an explicit override.
/// Tests pin the same value so they don't have to thread it through every
/// case.
const String kDefaultApiBaseUrl = 'http://localhost:3000';

const Duration _connectTimeout = Duration(seconds: 10);
const Duration _receiveTimeout = Duration(seconds: 30);
const Duration _sendTimeout = Duration(seconds: 30);

/// In-memory GET-response cache TTL (5 minutes).
const Duration kCacheTtl = Duration(minutes: 5);

/// Extra-key used on a [RequestOptions] to opt out of the cache for a single
/// request (e.g. `dio.get(url, options: Options(extra: {kSkipCacheKey: true}))`).
const String kSkipCacheKey = '_skipCache';

/// Extra-key set by the response interceptor when the response was served
/// from the in-memory cache rather than the network.
const String kCacheHitKey = '_cacheHit';

/// Maximum retry attempts for idempotent GETs on network errors / 5xx.
const int _maxRetries = 2;

/// Exponential-ish backoff durations for the 2 retries (200ms, 800ms).
const List<Duration> kDefaultRetryDelays = <Duration>[
  Duration(milliseconds: 200),
  Duration(milliseconds: 800),
];

/// Holds the configured [Dio] plus the mutable auth token reference so we can
/// expose a single Riverpod-provided client whose token can be rotated without
/// rebuilding the entire HTTP stack.
class ApiClient {
  ApiClient({
    required this.dio,
    required this.cache,
    String? authToken,
    String? baseUrl,
  })  : _authToken = authToken,
        baseUrl = baseUrl ?? dio.options.baseUrl;

  final Dio dio;
  final ResponseCache cache;
  final String baseUrl;
  String? _authToken;

  String? get authToken => _authToken;
  set authToken(String? value) {
    _authToken = value;
  }

  /// Clears the entire in-memory response cache. Useful after auth changes or
  /// when the user pulls-to-refresh.
  void invalidateCache() => cache.clear();

  /// Removes a single cached entry for [path] (+ optional [query]) so the next
  /// matching GET hits the network again.
  void invalidate(String path, {Map<String, dynamic>? query}) =>
      cache.remove(_cacheKey(path, query));
}

/// Riverpod provider exposing the configured [ApiClient]. Higher-level
/// providers can override this for tests by swapping in a fake Dio.
final apiClientProvider = Provider<ApiClient>((ref) {
  return createApiClient(kDefaultApiBaseUrl);
});

/// Factory that wires up Dio + interceptors + in-memory cache.
///
/// [baseUrl] is the backend root (e.g. `http://localhost:3000`).
/// [authToken] is injected into the `Authorization: Bearer …` header on every
/// request when non-null. Pass [dio] to override the underlying client (used
/// by tests that want to attach `http_mock_adapter` to a pre-built Dio).
ApiClient createApiClient(
  String baseUrl, {
  String? authToken,
  Dio? dio,
  ResponseCache? cache,
  RequestIdGenerator? requestIdGenerator,
  List<Duration>? retryDelays,
}) {
  final resolvedCache = cache ?? ResponseCache();
  final resolvedDio = dio ??
      Dio(BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: _connectTimeout,
        receiveTimeout: _receiveTimeout,
        sendTimeout: _sendTimeout,
        responseType: ResponseType.json,
        headers: <String, dynamic>{
          'Accept': 'application/json',
        },
      ));

  // Preserve baseUrl on the dio instance so cache keys are consistent.
  if (resolvedDio.options.baseUrl.isEmpty) {
    resolvedDio.options.baseUrl = baseUrl;
  }

  final client = ApiClient(
    dio: resolvedDio,
    cache: resolvedCache,
    authToken: authToken,
    baseUrl: baseUrl,
  );

  resolvedDio.interceptors.add(_AuthAndRequestIdInterceptor(
    client: client,
    requestId: requestIdGenerator ?? _defaultRequestId,
  ));
  resolvedDio.interceptors.add(_CacheInterceptor(cache: resolvedCache));
  resolvedDio.interceptors.add(_RetryInterceptor(
    dio: resolvedDio,
    delays: retryDelays ?? kDefaultRetryDelays,
  ));

  return client;
}

/// Injects the `Authorization` header (when a token is configured) and a
/// freshly-minted `X-Request-ID` header on every outgoing request.
class _AuthAndRequestIdInterceptor extends Interceptor {
  _AuthAndRequestIdInterceptor({
    required this.client,
    required this.requestId,
  });

  final ApiClient client;
  final RequestIdGenerator requestId;

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) {
    final token = client.authToken;
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    options.headers['X-Request-ID'] = requestId();
    handler.next(options);
  }
}

/// Serves GET responses from an in-memory TTL cache when available, and
/// populates the cache on success.
class _CacheInterceptor extends Interceptor {
  _CacheInterceptor({required this.cache});

  final ResponseCache cache;

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) {
    if (!_isCacheable(options)) {
      handler.next(options);
      return;
    }
    final key = _cacheKey(options.path, options.queryParameters);
    final hit = cache.get(key);
    if (hit != null) {
      handler.resolve(
        Response<dynamic>(
          requestOptions: options,
          data: hit,
          statusCode: 200,
          extra: <String, dynamic>{kCacheHitKey: true},
        ),
      );
      return;
    }
    handler.next(options);
  }

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    final options = response.requestOptions;
    final fromCache = response.extra[kCacheHitKey] == true;
    if (!fromCache &&
        _isCacheable(options) &&
        response.statusCode != null &&
        response.statusCode! >= 200 &&
        response.statusCode! < 300) {
      cache.set(_cacheKey(options.path, options.queryParameters), response.data);
    }
    handler.next(response);
  }
}

/// Retries idempotent GETs on network errors and 5xx responses with
/// exponential-ish backoff. 4xx responses are never retried.
class _RetryInterceptor extends Interceptor {
  _RetryInterceptor({required this.dio, required this.delays});

  final Dio dio;
  final List<Duration> delays;

  static const String _attemptKey = '_retryAttempt';

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final options = err.requestOptions;
    if (!_shouldRetry(err)) {
      handler.next(err);
      return;
    }

    final attempt = (options.extra[_attemptKey] as int?) ?? 0;
    final maxRetries = delays.length < _maxRetries ? delays.length : _maxRetries;
    if (attempt >= maxRetries) {
      handler.next(err);
      return;
    }

    final delay = delays[attempt];
    await Future<void>.delayed(delay);

    final nextOptions = options.copyWith(
      extra: <String, dynamic>{
        ...options.extra,
        _attemptKey: attempt + 1,
      },
    );

    try {
      final response = await dio.fetch<dynamic>(nextOptions);
      handler.resolve(response);
    } on DioException catch (e) {
      handler.next(e);
    }
  }

  bool _shouldRetry(DioException err) {
    final options = err.requestOptions;
    if (options.method.toUpperCase() != 'GET') return false;

    // Cache-resolved short-circuits never trigger onError, so we only see
    // genuine outbound failures here.
    final status = err.response?.statusCode;
    if (status != null) {
      if (status >= 500 && status < 600) return true;
      // 4xx — explicit "never retry"
      return false;
    }

    // No response → network class error. Retry for the recoverable kinds.
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.connectionError:
      case DioExceptionType.unknown:
        return true;
      case DioExceptionType.badResponse:
      case DioExceptionType.cancel:
      case DioExceptionType.badCertificate:
        return false;
    }
  }
}

bool _isCacheable(RequestOptions options) {
  if (options.method.toUpperCase() != 'GET') return false;
  if (options.extra[kSkipCacheKey] == true) return false;
  return true;
}

String _cacheKey(String path, Map<String, dynamic>? query) {
  if (query == null || query.isEmpty) return path;
  final sorted = query.keys.toList()..sort();
  final qs = sorted.map((k) => '$k=${query[k]}').join('&');
  return '$path?$qs';
}

/// Minimal TTL cache. Public so tests and callers can construct or share
/// instances explicitly.
class ResponseCache {
  ResponseCache({Duration ttl = kCacheTtl, DateTime Function()? now})
      : _ttl = ttl,
        _now = now ?? DateTime.now;

  final Duration _ttl;
  final DateTime Function() _now;
  final Map<String, _CacheEntry> _store = <String, _CacheEntry>{};

  /// Returns the cached value if present and not yet expired. Expired entries
  /// are evicted lazily on read.
  dynamic get(String key) {
    final entry = _store[key];
    if (entry == null) return null;
    if (entry.expiresAt.isBefore(_now())) {
      _store.remove(key);
      return null;
    }
    return entry.value;
  }

  void set(String key, dynamic value) {
    _store[key] = _CacheEntry(value: value, expiresAt: _now().add(_ttl));
  }

  void remove(String key) => _store.remove(key);

  void clear() => _store.clear();

  int get length => _store.length;
}

class _CacheEntry {
  _CacheEntry({required this.value, required this.expiresAt});
  final dynamic value;
  final DateTime expiresAt;
}

/// Parses a [DioException] into our [ApiException] envelope. Centralised so
/// every typed API wrapper raises the same shape.
///
/// [stack] is accepted but not stored — callers can pass the stack from a
/// `catch (e, st)` clause if a future revision wants to forward it.
ApiException toApiException(Object error, [StackTrace? stack]) {
  if (error is ApiException) return error;
  if (error is DioException) {
    final response = error.response;
    if (response != null) {
      final parsed = _parseErrorBody(response.data);
      return ApiException(
        statusCode: response.statusCode,
        error: parsed,
        cause: error,
      );
    }
    return ApiException(
      error: ApiError.client(
        error: _slugFromDioType(error.type),
        message: error.message,
      ),
      cause: error,
    );
  }
  return ApiException(
    error: ApiError.client(
      error: 'unknown_error',
      message: error.toString(),
    ),
    cause: error,
  );
}

ApiError _parseErrorBody(Object? data) {
  if (data is Map<String, dynamic>) {
    try {
      return ApiError.fromJson(data);
    } catch (_) {
      // Fall through to synthetic envelope below.
    }
    final err = data['error'];
    final msg = data['message'];
    return ApiError(
      error: err is String ? err : 'server_error',
      message: msg is String ? msg : null,
    );
  }
  if (data is String && data.isNotEmpty) {
    try {
      final decoded = jsonDecode(data);
      if (decoded is Map<String, dynamic>) {
        return _parseErrorBody(decoded);
      }
    } catch (_) {
      // Not JSON — fall through.
    }
    return ApiError(error: 'server_error', message: data);
  }
  return const ApiError(error: 'server_error');
}

String _slugFromDioType(DioExceptionType type) {
  switch (type) {
    case DioExceptionType.connectionTimeout:
      return 'connection_timeout';
    case DioExceptionType.sendTimeout:
      return 'send_timeout';
    case DioExceptionType.receiveTimeout:
      return 'receive_timeout';
    case DioExceptionType.connectionError:
      return 'connection_error';
    case DioExceptionType.badCertificate:
      return 'bad_certificate';
    case DioExceptionType.cancel:
      return 'request_cancelled';
    case DioExceptionType.badResponse:
      return 'bad_response';
    case DioExceptionType.unknown:
      return 'network_error';
  }
}
