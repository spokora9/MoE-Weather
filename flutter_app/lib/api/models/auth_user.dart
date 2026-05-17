/// `GET /api/auth/me` response. Shape: `{ id, email, tier }`.
///
/// Note: the backend itself does not own `/signup`/`/signin` HTTP routes —
/// those flow through Supabase directly. We keep [AuthSession] here as a
/// convenience for callers that hold a Supabase session and want to pair it
/// with the backend-resolved tier.
class AuthUser {
  const AuthUser({required this.id, this.email, this.tier});

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String,
        email: json['email'] as String?,
        tier: json['tier'] as String?,
      );

  final String id;
  final String? email;
  final String? tier;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        if (email != null) 'email': email,
        if (tier != null) 'tier': tier,
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AuthUser &&
          other.id == id &&
          other.email == email &&
          other.tier == tier);

  @override
  int get hashCode => Object.hash(runtimeType, id, email, tier);
}

class AuthSession {
  const AuthSession({
    required this.accessToken,
    this.refreshToken,
    this.expiresIn,
    this.tokenType,
    this.user,
  });

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
        accessToken: (json['accessToken'] ??
            json['access_token'] ??
            json['token']) as String,
        refreshToken:
            (json['refreshToken'] ?? json['refresh_token']) as String?,
        expiresIn:
            (json['expiresIn'] ?? json['expires_in']) as int?,
        tokenType: (json['tokenType'] ?? json['token_type']) as String?,
        user: json['user'] is Map
            ? AuthUser.fromJson((json['user'] as Map).cast<String, dynamic>())
            : null,
      );

  final String accessToken;
  final String? refreshToken;
  final int? expiresIn;
  final String? tokenType;
  final AuthUser? user;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'accessToken': accessToken,
        if (refreshToken != null) 'refreshToken': refreshToken,
        if (expiresIn != null) 'expiresIn': expiresIn,
        if (tokenType != null) 'tokenType': tokenType,
        if (user != null) 'user': user!.toJson(),
      };
}
