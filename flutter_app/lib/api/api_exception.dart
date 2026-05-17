import 'models/api_error.dart';

/// Exception thrown by any of the typed API wrappers when a request fails.
///
/// Wraps the HTTP status code (when available) and an [ApiError] parsed from
/// the backend's JSON error envelope (`{ error, message, retryAfter?,
/// upgradeUrl? }`). For network / parse / unexpected failures the [error]
/// payload will still be populated with a synthetic value so callers always
/// have a stable shape to switch on.
class ApiException implements Exception {
  ApiException({
    required this.error,
    this.statusCode,
    this.cause,
  });

  final ApiError error;
  final int? statusCode;
  final Object? cause;

  /// Convenience: backend `error` slug (e.g. `upgrade_required`).
  String get code => error.error;

  /// Convenience: human-readable backend `message` (falls back to slug).
  String get message => error.message ?? error.error;

  bool get isUpgradeRequired => statusCode == 402 || code == 'upgrade_required';
  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;
  bool get isClientError =>
      statusCode != null && statusCode! >= 400 && statusCode! < 500;
  bool get isServerError =>
      statusCode != null && statusCode! >= 500 && statusCode! < 600;

  @override
  String toString() =>
      'ApiException(statusCode: $statusCode, code: $code, message: $message)';
}
