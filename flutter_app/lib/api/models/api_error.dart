/// Parsed `{ error, message, retryAfter?, upgradeUrl? }` envelope returned by
/// the backend for any non-2xx response.
///
/// `error` is the machine-readable slug (e.g. `upgrade_required`,
/// `service_unavailable`). `message` is the human-readable explanation.
/// `retryAfter` (seconds) is set on 429 responses. `upgradeUrl` is set on 402
/// responses for tier-gated endpoints.
///
/// Implementation note: this would normally be a `freezed` class, but the
/// build_runner code-gen step is not part of the test/CI lane for this task
/// (sandbox denies `flutter pub get` and `dart run build_runner`), so the
/// JSON serialisation is hand-written. Equality + copyWith are explicitly
/// defined for the same reason.
class ApiError {
  const ApiError({
    required this.error,
    this.message,
    this.retryAfter,
    this.upgradeUrl,
    this.details,
  });

  factory ApiError.fromJson(Map<String, dynamic> json) => ApiError(
        error: (json['error'] as String?) ?? 'unknown_error',
        message: json['message'] as String?,
        retryAfter: (json['retryAfter'] as num?)?.toInt(),
        upgradeUrl: json['upgradeUrl'] as String?,
        details: json['details'] is List
            ? List<dynamic>.from(json['details'] as List)
            : null,
      );

  /// Build a synthetic error envelope for client-side failures (network,
  /// parse, unknown). Mirrors the backend shape so callers can switch on the
  /// same `error` slugs.
  factory ApiError.client({
    required String error,
    String? message,
  }) =>
      ApiError(error: error, message: message);

  final String error;
  final String? message;
  final int? retryAfter;
  final String? upgradeUrl;
  final List<dynamic>? details;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'error': error,
        if (message != null) 'message': message,
        if (retryAfter != null) 'retryAfter': retryAfter,
        if (upgradeUrl != null) 'upgradeUrl': upgradeUrl,
        if (details != null) 'details': details,
      };

  ApiError copyWith({
    String? error,
    String? message,
    int? retryAfter,
    String? upgradeUrl,
    List<dynamic>? details,
  }) =>
      ApiError(
        error: error ?? this.error,
        message: message ?? this.message,
        retryAfter: retryAfter ?? this.retryAfter,
        upgradeUrl: upgradeUrl ?? this.upgradeUrl,
        details: details ?? this.details,
      );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ApiError &&
          other.error == error &&
          other.message == message &&
          other.retryAfter == retryAfter &&
          other.upgradeUrl == upgradeUrl);

  @override
  int get hashCode =>
      Object.hash(runtimeType, error, message, retryAfter, upgradeUrl);

  @override
  String toString() =>
      'ApiError(error: $error, message: $message, retryAfter: $retryAfter, upgradeUrl: $upgradeUrl)';
}
