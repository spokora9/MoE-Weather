/// Wire shape accepted by `POST /api/notifications/subscribe`. Matches the
/// W3C PushSubscription JSON exported by `pushSubscription.toJSON()`.
class PushSubscriptionInput {
  const PushSubscriptionInput({required this.endpoint, required this.keys});

  factory PushSubscriptionInput.fromJson(Map<String, dynamic> json) =>
      PushSubscriptionInput(
        endpoint: json['endpoint'] as String,
        keys: PushSubscriptionKeys.fromJson(
          (json['keys'] as Map).cast<String, dynamic>(),
        ),
      );

  final String endpoint;
  final PushSubscriptionKeys keys;

  Map<String, dynamic> toJson() =>
      <String, dynamic>{'endpoint': endpoint, 'keys': keys.toJson()};
}

class PushSubscriptionKeys {
  const PushSubscriptionKeys({required this.p256dh, required this.auth});

  factory PushSubscriptionKeys.fromJson(Map<String, dynamic> json) =>
      PushSubscriptionKeys(
        p256dh: json['p256dh'] as String,
        auth: json['auth'] as String,
      );

  final String p256dh;
  final String auth;

  Map<String, dynamic> toJson() =>
      <String, dynamic>{'p256dh': p256dh, 'auth': auth};
}

/// Row returned by Supabase after upsert into `push_subscriptions`.
class PushSubscriptionRecord {
  const PushSubscriptionRecord({
    this.id,
    this.userId,
    required this.endpoint,
    this.p256dh,
    this.auth,
    this.createdAt,
  });

  factory PushSubscriptionRecord.fromJson(Map<String, dynamic> json) =>
      PushSubscriptionRecord(
        id: json['id'] as String?,
        userId: json['user_id'] as String?,
        endpoint: json['endpoint'] as String,
        p256dh: json['p256dh'] as String?,
        auth: json['auth'] as String?,
        createdAt: json['created_at'] is String
            ? DateTime.parse(json['created_at'] as String)
            : null,
      );

  final String? id;
  final String? userId;
  final String endpoint;
  final String? p256dh;
  final String? auth;
  final DateTime? createdAt;

  Map<String, dynamic> toJson() => <String, dynamic>{
        if (id != null) 'id': id,
        if (userId != null) 'user_id': userId,
        'endpoint': endpoint,
        if (p256dh != null) 'p256dh': p256dh,
        if (auth != null) 'auth': auth,
        if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      };
}

/// Result of `POST /api/notifications/test`.
class PushTestResult {
  const PushTestResult({
    required this.sent,
    required this.failed,
    required this.total,
  });

  factory PushTestResult.fromJson(Map<String, dynamic> json) => PushTestResult(
        sent: (json['sent'] as num).toInt(),
        failed: (json['failed'] as num).toInt(),
        total: (json['total'] as num).toInt(),
      );

  final int sent;
  final int failed;
  final int total;

  Map<String, dynamic> toJson() =>
      <String, dynamic>{'sent': sent, 'failed': failed, 'total': total};
}

/// `GET /api/notifications/vapid-public-key` body: `{ publicKey }`.
class VapidPublicKey {
  const VapidPublicKey({required this.publicKey});

  factory VapidPublicKey.fromJson(Map<String, dynamic> json) =>
      VapidPublicKey(publicKey: json['publicKey'] as String);

  final String publicKey;

  Map<String, dynamic> toJson() => <String, dynamic>{'publicKey': publicKey};
}
