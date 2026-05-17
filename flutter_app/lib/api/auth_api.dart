import 'api_client.dart';
import 'api_exception.dart';
import 'models/api_error.dart';
import 'models/auth_user.dart';

/// Typed wrapper around the backend `/api/auth/*` routes.
///
/// Backend ownership note: only `GET /me` and `POST /signout` are routed
/// through the backend today (see `src/routes/auth.ts`). Sign-up / sign-in
/// happen against Supabase directly. We surface stubs for those flows that
/// call the documented endpoints anyway so consumers can switch transports
/// later without changing call sites, but in the current backend they will
/// 404.
class AuthApi {
  AuthApi(this._client);

  final ApiClient _client;

  Future<AuthUser> me() async {
    try {
      final response = await _client.dio.get<dynamic>('/api/auth/me');
      return AuthUser.fromJson(
        (response.data as Map).cast<String, dynamic>(),
      );
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }

  /// Calls `POST /api/auth/signout`. Server-side this is a no-op log; clients
  /// are still responsible for discarding the local token.
  Future<void> signOut() async {
    try {
      await _client.dio.post<dynamic>('/api/auth/signout');
    } catch (e, st) {
      throw toApiException(e, st);
    } finally {
      // Drop the in-memory cache so any tier-gated payloads aren't reused
      // under the next user's identity.
      _client.invalidateCache();
    }
  }

  /// Calls `POST /api/auth/signup`. Backend currently does not implement this
  /// route — see class-level note. Body shape matches the planned route.
  Future<AuthSession> signUp({
    required String email,
    required String password,
  }) async {
    return _authPost('/api/auth/signup', email: email, password: password);
  }

  /// Calls `POST /api/auth/signin`. See class-level note.
  Future<AuthSession> signIn({
    required String email,
    required String password,
  }) async {
    return _authPost('/api/auth/signin', email: email, password: password);
  }

  Future<AuthSession> _authPost(
    String path, {
    required String email,
    required String password,
  }) async {
    try {
      final response = await _client.dio.post<dynamic>(
        path,
        data: <String, dynamic>{'email': email, 'password': password},
      );
      final data = response.data;
      if (data is Map<String, dynamic>) {
        return AuthSession.fromJson(data);
      }
      if (data is Map) {
        return AuthSession.fromJson(data.cast<String, dynamic>());
      }
      throw ApiException(
        error: ApiError.client(
          error: 'invalid_response',
          message: 'Auth response was not a JSON object',
        ),
      );
    } catch (e, st) {
      throw toApiException(e, st);
    }
  }
}
