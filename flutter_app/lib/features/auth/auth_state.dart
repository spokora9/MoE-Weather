import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Subscription / access tier for the active user.
///
/// - [anonymous]: no signed-in user.
/// - [free]: signed-in user without an active "pro" entitlement.
/// - [pro]: signed-in user with an active "pro" RevenueCat entitlement.
enum SubscriptionTier { anonymous, free, pro }

/// Minimal user profile pulled from Supabase. Kept narrow so that test code
/// does not need to mock the full Supabase user type.
class AuthUser {
  const AuthUser({required this.id, required this.email});

  final String id;
  final String email;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuthUser && other.id == id && other.email == email;

  @override
  int get hashCode => Object.hash(id, email);
}

/// Sealed union describing the auth state observed by the rest of the app.
///
/// We use a hand-rolled sealed class instead of a `freezed` union so the file
/// does not depend on a `build_runner` pass to compile.
sealed class AuthState {
  const AuthState();

  const factory AuthState.loading() = AuthLoading;
  const factory AuthState.anonymous() = AuthAnonymous;
  const factory AuthState.authenticated({
    required AuthUser user,
    required SubscriptionTier tier,
  }) = AuthAuthenticated;

  T when<T>({
    required T Function() loading,
    required T Function() anonymous,
    required T Function(AuthUser user, SubscriptionTier tier) authenticated,
  }) {
    final self = this;
    return switch (self) {
      AuthLoading() => loading(),
      AuthAnonymous() => anonymous(),
      AuthAuthenticated(:final user, :final tier) => authenticated(user, tier),
    };
  }
}

final class AuthLoading extends AuthState {
  const AuthLoading();

  @override
  bool operator ==(Object other) => other is AuthLoading;

  @override
  int get hashCode => 0;
}

final class AuthAnonymous extends AuthState {
  const AuthAnonymous();

  @override
  bool operator ==(Object other) => other is AuthAnonymous;

  @override
  int get hashCode => 1;
}

final class AuthAuthenticated extends AuthState {
  const AuthAuthenticated({required this.user, required this.tier});

  final AuthUser user;
  final SubscriptionTier tier;

  AuthAuthenticated copyWith({AuthUser? user, SubscriptionTier? tier}) {
    return AuthAuthenticated(
      user: user ?? this.user,
      tier: tier ?? this.tier,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuthAuthenticated && other.user == user && other.tier == tier;

  @override
  int get hashCode => Object.hash(user, tier);
}

/// AsyncNotifier driving the global auth state. The notifier itself only
/// owns lifecycle; pushing new states is the responsibility of the Supabase
/// auth listener (see `supabase_auth.dart`) and the tier resolver (see
/// `revenuecat_service.dart`).
class AuthStateNotifier extends AsyncNotifier<AuthState> {
  @override
  Future<AuthState> build() async => const AuthState.loading();

  /// Replace the current auth state with [next]. Wraps the value in
  /// [AsyncValue.data] so consumers using `AsyncValue` UI helpers still work.
  void replaceState(AuthState next) {
    state = AsyncData(next);
  }

  /// Convenience: mark the user as anonymous.
  void setAnonymous() => replaceState(const AuthState.anonymous());

  /// Convenience: mark the user as authenticated with [user] and [tier].
  void setAuthenticated(AuthUser user, SubscriptionTier tier) {
    replaceState(AuthState.authenticated(user: user, tier: tier));
  }
}

/// Global auth state provider. Widgets `ref.watch(authStateProvider)` to react
/// to sign-in / sign-out / tier changes.
final authStateProvider =
    AsyncNotifierProvider<AuthStateNotifier, AuthState>(AuthStateNotifier.new);
