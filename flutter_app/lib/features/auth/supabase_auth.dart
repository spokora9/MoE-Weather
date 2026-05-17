import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as sb;

import 'auth_state.dart';

/// Thin wrapper around the Supabase Flutter SDK so the rest of the app does
/// not depend on `supabase_flutter` directly.
class SupabaseAuthService {
  SupabaseAuthService({
    sb.SupabaseClient? client,
    GoogleSignIn? googleSignIn,
  })  : _explicitClient = client,
        _googleSignIn = googleSignIn ?? GoogleSignIn();

  final sb.SupabaseClient? _explicitClient;
  final GoogleSignIn _googleSignIn;

  sb.SupabaseClient get _client => _explicitClient ?? sb.Supabase.instance.client;

  /// Initialize the Supabase singleton. Must be called from `main()` before
  /// `runApp`. Keys are passed in (typically from `--dart-define`).
  static Future<void> initializeSupabase({
    required String url,
    required String anonKey,
  }) async {
    await sb.Supabase.initialize(url: url, anonKey: anonKey);
  }

  /// Sign up with email + password. Returns the `AuthResponse` from Supabase.
  Future<sb.AuthResponse> signUpWithEmail({
    required String email,
    required String password,
  }) {
    return _client.auth.signUp(email: email, password: password);
  }

  /// Sign in with email + password.
  Future<sb.AuthResponse> signInWithEmail({
    required String email,
    required String password,
  }) {
    return _client.auth.signInWithPassword(email: email, password: password);
  }

  /// Sign in with Google via the `google_sign_in` plugin, then exchange the
  /// id/access tokens with Supabase via `signInWithIdToken`.
  Future<sb.AuthResponse> signInWithGoogle() async {
    final googleUser = await _googleSignIn.signIn();
    if (googleUser == null) {
      throw const sb.AuthException('Google sign-in was cancelled.');
    }
    final googleAuth = await googleUser.authentication;
    final idToken = googleAuth.idToken;
    final accessToken = googleAuth.accessToken;
    if (idToken == null) {
      throw const sb.AuthException(
        'Google sign-in did not return an id token.',
      );
    }
    return _client.auth.signInWithIdToken(
      provider: sb.OAuthProvider.google,
      idToken: idToken,
      accessToken: accessToken,
    );
  }

  /// Sign the current user out (Supabase + Google).
  Future<void> signOut() async {
    await _client.auth.signOut();
    try {
      await _googleSignIn.signOut();
    } catch (_) {
      // Google sign-out is best-effort.
    }
  }

  /// Underlying auth state stream from Supabase.
  Stream<sb.AuthState> get onAuthStateChange => _client.auth.onAuthStateChange;

  /// Current session, if any.
  sb.Session? get currentSession => _client.auth.currentSession;

  /// Current Supabase user, if any.
  sb.User? get currentUser => _client.auth.currentUser;
}

/// Provides the [SupabaseAuthService] singleton.
final supabaseAuthServiceProvider = Provider<SupabaseAuthService>((ref) {
  return SupabaseAuthService();
});

/// Streams the Supabase auth state, emitting once for the current session and
/// then on every subsequent change. Used by the tier resolver and to keep
/// [authStateProvider] in sync.
final supabaseUserProvider = StreamProvider<AuthUser?>((ref) {
  final service = ref.watch(supabaseAuthServiceProvider);
  AuthUser? toAppUser(sb.User? user) {
    if (user == null) return null;
    return AuthUser(id: user.id, email: user.email ?? '');
  }

  // Emit the current value immediately so consumers do not block on the first
  // auth event.
  final initial = toAppUser(service.currentUser);
  final controller = StreamController<AuthUser?>();
  controller.add(initial);
  final sub = service.onAuthStateChange.listen((state) {
    controller.add(toAppUser(state.session?.user));
  });
  ref.onDispose(() {
    sub.cancel();
    controller.close();
  });
  return controller.stream;
});
